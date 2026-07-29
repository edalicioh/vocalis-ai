import asyncio
import json
import logging
import os
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcription-service")

app = FastAPI(title="Faster-Whisper Transcription Service")

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")  # "cuda" ou "cpu"
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "auto")
WHISPER_TASK = os.getenv("WHISPER_TASK", "transcribe")

logger.info(f"Carregando modelo faster-whisper '{MODEL_SIZE}' na device '{DEVICE}' com compute_type='{COMPUTE_TYPE}', idioma='{WHISPER_LANGUAGE}', task='{WHISPER_TASK}'...")
try:
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    logger.info("Modelo faster-whisper carregado com sucesso.")
except Exception as e:
    logger.error(f"Erro ao carregar faster-whisper: {e}")
    model = None

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "language": WHISPER_LANGUAGE,
        "task": WHISPER_TASK,
        "model_loaded": model is not None
    }

def _run_whisper_transcription(audio_data: np.ndarray, target_language: str = None, target_task: str = None):
    if model is None:
        return None
    lang_setting = target_language if target_language is not None else WHISPER_LANGUAGE
    task_setting = target_task if target_task is not None else WHISPER_TASK
    lang_param = None if str(lang_setting).lower() in ("auto", "none", "") else lang_setting
    
    segments, info = model.transcribe(
        audio_data,
        beam_size=3,
        language=lang_param,
        task=task_setting,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=400,
            threshold=0.5
        )
    )
    segments_list = list(segments)
    full_text = " ".join([seg.text.strip() for seg in segments_list if seg.text.strip()])
    if not full_text:
        return None
    
    start_time = segments_list[0].start if segments_list else 0.0
    end_time = segments_list[-1].end if segments_list else 0.0
    avg_confidence = (
        sum(seg.avg_logprob for seg in segments_list) / len(segments_list)
        if segments_list else 0.0
    )
    confidence = min(1.0, max(0.0, 1.0 + avg_confidence))
    return full_text, info.language, info.language_probability, confidence, start_time, end_time

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    logger.info("Cliente WebSocket conectado ao serviço de transcrição.")
    
    audio_buffer = bytearray()
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2  # 16-bit PCM (int16)
    CHUNK_SIZE_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * 1.5)

    client_language = None
    client_task = None

    try:
        while True:
            data = await websocket.receive()
            if "bytes" in data and data["bytes"]:
                audio_buffer.extend(data["bytes"])
                
                if len(audio_buffer) >= CHUNK_SIZE_BYTES:
                    raw_bytes = bytes(audio_buffer)
                    audio_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
                    audio_float32 = audio_int16.astype(np.float32) / 32768.0

                    res = await asyncio.to_thread(_run_whisper_transcription, audio_float32, client_language, client_task)

                    if res:
                        full_text, lang, lang_prob, confidence, start_time, end_time = res

                        logger.info(f"🎙️ [Whisper Transcrição]: '{full_text}' (lang={lang}, prob={lang_prob:.2f}, conf={confidence:.2f})")

                        response_msg = {
                            "type": "transcript.final",
                            "payload": {
                                "text": full_text,
                                "language": lang,
                                "probability": lang_prob,
                                "confidence": round(confidence, 2),
                                "start": round(start_time, 2),
                                "end": round(end_time, 2)
                            }
                        }
                        await websocket.send_text(json.dumps(response_msg))

                    overlap_bytes = int(SAMPLE_RATE * BYTES_PER_SAMPLE * 0.5)
                    audio_buffer = audio_buffer[-overlap_bytes:]

            elif "text" in data and data["text"]:
                msg = json.loads(data["text"])
                if msg.get("type") == "RESET":
                    audio_buffer.clear()
                    await websocket.send_text(json.dumps({"type": "RESET_ACK"}))
                elif msg.get("type") == "SET_CONFIG":
                    payload = msg.get("payload", {})
                    if "language" in payload:
                        client_language = payload["language"]
                    if "task" in payload:
                        client_task = payload["task"]
                    await websocket.send_text(json.dumps({"type": "CONFIG_ACK", "payload": {"language": client_language, "task": client_task}}))

    except WebSocketDisconnect:
        logger.info("Cliente WebSocket desconectado.")
    except Exception as e:
        logger.error(f"Erro no processamento de transcrição: {e}")
        try:
            await websocket.send_text(json.dumps({"type": "error", "payload": {"message": str(e)}}))
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

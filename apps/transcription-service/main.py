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
PARTIAL_INTERVAL_SECONDS = float(os.getenv("WHISPER_PARTIAL_INTERVAL", "1.0"))
MAX_SEGMENT_SECONDS = float(os.getenv("WHISPER_MAX_SEGMENT", "15.0"))
SILENCE_FINALIZE_SECONDS = float(os.getenv("WHISPER_SILENCE_FINALIZE", "0.8"))

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
        "partial_interval": PARTIAL_INTERVAL_SECONDS,
        "max_segment": MAX_SEGMENT_SECONDS,
        "silence_finalize": SILENCE_FINALIZE_SECONDS,
        "model_loaded": model is not None
    }

def _run_whisper_transcription(
    audio_data: np.ndarray,
    target_language: str = None,
    target_task: str = None,
    beam_size: int = 3
):
    if model is None:
        return None
    lang_setting = target_language if target_language is not None else WHISPER_LANGUAGE
    task_setting = target_task if target_task is not None else WHISPER_TASK
    lang_param = None if str(lang_setting).lower() in ("auto", "none", "") else lang_setting
    
    segments, info = model.transcribe(
        audio_data,
        beam_size=beam_size,
        language=lang_param,
        task=task_setting,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=300,
            speech_pad_ms=200,
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
    PARTIAL_INTERVAL_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * PARTIAL_INTERVAL_SECONDS)
    MAX_SEGMENT_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * MAX_SEGMENT_SECONDS)

    client_language = None
    client_task = None
    detected_language = None
    bytes_since_partial = 0

    async def transcribe_buffer(event_type: str):
        nonlocal detected_language
        if not audio_buffer:
            return

        audio_int16 = np.frombuffer(bytes(audio_buffer), dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0
        effective_language = client_language or detected_language
        beam_size = 1 if event_type == "transcript.partial" else 5
        res = await asyncio.to_thread(
            _run_whisper_transcription,
            audio_float32,
            effective_language,
            client_task,
            beam_size
        )

        if not res:
            return

        full_text, lang, lang_prob, confidence, start_time, end_time = res
        if (
            event_type == "transcript.final"
            and client_language is None
            and str(WHISPER_LANGUAGE).lower() in ("auto", "none", "")
            and lang_prob >= 0.8
        ):
            detected_language = lang

        logger.info(
            f"🎙️ [Whisper Transcrição {event_type}]: '{full_text}' "
            f"(lang={lang}, prob={lang_prob:.2f}, conf={confidence:.2f})"
        )
        await websocket.send_text(json.dumps({
            "type": event_type,
            "payload": {
                "text": full_text,
                "language": lang,
                "probability": lang_prob,
                "confidence": round(confidence, 2),
                "start": round(start_time, 2),
                "end": round(end_time, 2)
            }
        }))

    try:
        while True:
            if audio_buffer:
                try:
                    data = await asyncio.wait_for(
                        websocket.receive(),
                        timeout=SILENCE_FINALIZE_SECONDS
                    )
                except asyncio.TimeoutError:
                    await transcribe_buffer("transcript.final")
                    audio_buffer.clear()
                    bytes_since_partial = 0
                    continue
            else:
                data = await websocket.receive()

            if data.get("type") == "websocket.disconnect":
                break

            if "bytes" in data and data["bytes"]:
                audio_buffer.extend(data["bytes"])
                bytes_since_partial += len(data["bytes"])

                if len(audio_buffer) >= MAX_SEGMENT_BYTES:
                    await transcribe_buffer("transcript.final")
                    audio_buffer.clear()
                    bytes_since_partial = 0
                elif bytes_since_partial >= PARTIAL_INTERVAL_BYTES:
                    await transcribe_buffer("transcript.partial")
                    bytes_since_partial = 0

            elif "text" in data and data["text"]:
                msg = json.loads(data["text"])
                if msg.get("type") == "RESET":
                    audio_buffer.clear()
                    bytes_since_partial = 0
                    detected_language = None
                    await websocket.send_text(json.dumps({"type": "RESET_ACK"}))
                elif msg.get("type") == "SET_CONFIG":
                    payload = msg.get("payload", {})
                    if "language" in payload:
                        language = payload["language"]
                        client_language = None if str(language).lower() in ("auto", "none", "") else language
                        detected_language = None
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

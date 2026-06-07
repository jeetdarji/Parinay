# File: main.py
# Purpose: FastAPI entry point — model loading (lifespan), CORS, routers, health.
# Phase: 2 — Backend Base + Matching Engine
#
# STARTUP SEQUENCE:
# 1. Python loads main.py, imports all routers and services
# 2. dotenv loads .env variables into os.environ
# 3. FastAPI app is created with lifespan=lifespan
# 4. uvicorn starts serving requests immediately (app is "up")
# 5. Lifespan startup block begins executing:
#    a. app.state.models_loaded = False (health endpoint reports false)
#    b. spaCy en_core_web_sm loads (~2-3 seconds)
#    c. SentenceTransformer all-MiniLM-L6-v2 loads (~5-10 seconds)
#    d. NLPService instantiated with both models
#    e. app.state.nlp_service = nlp_instance
#    f. app.state.models_loaded = True (health endpoint now reports true)
# 6. Any request arriving before step 5f gets a 503 response
# 7. Frontend polls GET /health until models_loaded: true before
#    enabling the "Find Matches" button

import logging
import os
from contextlib import asynccontextmanager

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from routers.ai import router as ai_router
from routers.matching import router as matching_router
from services.nlp_service import NLPService

VERSION = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load NLP models once at startup; never crash the server on failure."""
    app.state.models_loaded = False
    app.state.spacy_loaded = False
    app.state.embeddings_loaded = False
    app.state.nlp_service = None
    app.state.gemini_configured = False

    # Initialize Gemini API key (independent of NLP model loading).
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        genai.configure(api_key=gemini_key)
        app.state.gemini_configured = True
        logger.info("Gemini API configured successfully")
    else:
        app.state.gemini_configured = False
        logger.warning(
            "GEMINI_API_KEY not set — AI endpoints will return fallback responses"
        )

    spacy_model = None
    sentence_model = None

    # -- spaCy --
    try:
        import spacy
        logger.info("Loading spaCy model en_core_web_sm ...")
        spacy_model = spacy.load("en_core_web_sm")
        app.state.spacy_loaded = True
        logger.info("spaCy model loaded.")
    except Exception:  # noqa: BLE001
        logger.error("Failed to load spaCy model.", exc_info=True)

    # -- sentence-transformers --
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading SentenceTransformer all-MiniLM-L6-v2 ...")
        sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
        app.state.embeddings_loaded = True
        logger.info("SentenceTransformer model loaded.")
    except Exception:  # noqa: BLE001
        logger.error("Failed to load SentenceTransformer model.", exc_info=True)

    # -- NLPService (only if both models loaded) --
    if app.state.spacy_loaded and app.state.embeddings_loaded:
        try:
            app.state.nlp_service = NLPService(spacy_model, sentence_model)
            app.state.models_loaded = True
            logger.info("NLPService ready. models_loaded=True")
        except Exception:  # noqa: BLE001
            logger.error("Failed to instantiate NLPService.", exc_info=True)
            app.state.models_loaded = False
    else:
        logger.error(
            "Models incomplete (spacy=%s, embeddings=%s); models_loaded=False",
            app.state.spacy_loaded, app.state.embeddings_loaded,
        )

    yield

    # -- shutdown (nothing to clean up explicitly) --
    logger.info("Shutting down TDC Matchmaker API.")


app = FastAPI(title="TDC Matchmaker API", version=VERSION, lifespan=lifespan)

# -- CORS --
_frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
_allowed_origins = [_frontend_origin]
# Include localhost for local development; harmless in production.
for _dev_origin in ("http://localhost:5173", "http://localhost:3000"):
    if _dev_origin not in _allowed_origins:
        _allowed_origins.append(_dev_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

# -- Routers --
app.include_router(matching_router, prefix="/match")
app.include_router(ai_router, prefix="/ai")


@app.get("/health")
async def health() -> dict:
    """Report model loading state so the frontend can implement wake/retry."""
    return {
        "status": "ok",
        "models_loaded": getattr(app.state, "models_loaded", False),
        "spacy_loaded": getattr(app.state, "spacy_loaded", False),
        "embeddings_loaded": getattr(app.state, "embeddings_loaded", False),
        "gemini_configured": getattr(app.state, "gemini_configured", False),
        "version": VERSION,
    }


@app.get("/")
async def root() -> dict:
    """Service banner."""
    return {
        "service": "TDC Matchmaker API",
        "version": VERSION,
        "status": "running",
        "docs": "/docs",
    }

# File: services/nlp_service.py
# Purpose: Wrap all NLP operations (embeddings, similarity, industry tagging).
# Phase: 2 — Backend Base + Matching Engine

import logging
from typing import Dict, Optional, Set

import numpy as np

logger = logging.getLogger(__name__)

# Embedding dimension for all-MiniLM-L6-v2.
_EMBED_DIM = 384

# Industry taxonomy — the ONLY valid return values from extract_industry().
INDUSTRIES = (
    "Technology",
    "Finance",
    "Healthcare",
    "Legal",
    "Education",
    "Media & Creative",
    "Consulting",
    "Government & Public Sector",
    "Entrepreneurship",
    "Manufacturing",
    "Real Estate",
    "Unknown",
)

# LAYER 1 keyword lookup table. Order matters: first list with a hit wins.
_INDUSTRY_KEYWORDS = {
    "Technology": [
        "software", "engineer", "developer", "tech", "swe", "infosys", "tcs",
        "wipro", "google", "microsoft", "amazon", "meta", "flipkart", "zomato",
        "swiggy", "razorpay", "cred", "phonepe", "atlassian", "data scientist",
        "machine learning", "devops", "product manager", "it ", "saas",
    ],
    "Finance": [
        "bank", "finance", "financial", "investment", "equity", "capital",
        "fund", "analyst", "trader", "portfolio", "hdfc", "icici", "kotak",
        "axis", "goldman", "morgan stanley", "citi", "jp morgan", "ca ",
        "chartered accountant", "fintech", "insurance", "actuarial",
    ],
    "Healthcare": [
        "doctor", "physician", "surgeon", "hospital", "clinic", "medical",
        "pharma", "nurse", "dentist", "apollo", "fortis", "max healthcare",
        "manipal", "aiims", "health", "physiotherapist", "psychologist",
        "psychiatrist", "resident", "mbbs", "md ",
    ],
    "Legal": [
        "lawyer", "attorney", "legal", "advocate", "counsel", "solicitor",
        "law firm", "azb", "trilegal", "cyril amarchand",
    ],
    "Education": [
        "teacher", "professor", "lecturer", "faculty", "academic",
        "university", "college", "iit", "iim", "school", "tutor", "education",
    ],
    "Media & Creative": [
        "journalist", "editor", "writer", "content", "media", "creative",
        "design", "ux", "ui designer", "brand", "marketing", "advertising",
        "vogue", "ndtv", "times of india", "photographer", "filmmaker",
    ],
    "Consulting": [
        "consultant", "consulting", "mckinsey", "bcg", "deloitte",
        "accenture", "ey", "kpmg", "strategy", "advisory", "bain",
    ],
    "Government & Public Sector": [
        "ias", "ips", "government", "civil service", "public sector",
        "ministry", "municipal", "defence", "army", "navy", "air force",
    ],
    "Entrepreneurship": [
        "founder", "co-founder", "entrepreneur", "startup",
        "ceo", "cto", "coo", "director", "self-employed", "own business",
    ],
    "Manufacturing": [
        "manufacturing", "production", "operations", "supply chain",
        "logistics", "automotive", "tata motors", "mahindra", "larsen",
    ],
    "Real Estate": [
        "real estate", "property", "construction", "architect", "realty",
    ],
}

# Subset of keyword lists used for the LAYER 2 (spaCy NER) re-check.
_NER_RECHECK_INDUSTRIES = ("Technology", "Finance", "Healthcare")

# Adjacency map for industry_compatibility_score (directional pairs added
# both ways to be symmetric).
_INDUSTRY_ADJACENCY: Dict[str, Set[str]] = {
    "Technology": {"Consulting", "Media & Creative", "Entrepreneurship"},
    "Consulting": {"Technology", "Finance", "Legal", "Entrepreneurship"},
    "Media & Creative": {"Technology", "Education"},
    "Finance": {"Consulting", "Entrepreneurship"},
    "Entrepreneurship": {"Finance", "Technology", "Consulting"},
    "Healthcare": {"Education"},
    "Education": {"Healthcare", "Media & Creative"},
    "Legal": {"Consulting"},
}


class NLPService:
    """Holds pre-loaded NLP models and exposes matching-related NLP helpers.

    Models are loaded ONCE in main.py's lifespan and passed in here. This class
    never loads models itself — that separation keeps RAM usage bounded on the
    Render free tier.
    """

    def __init__(self, spacy_model, sentence_model):
        self._nlp = spacy_model                 # spaCy Language object
        self._sentence_model = sentence_model   # SentenceTransformer object

    # -- METHOD 1 -----------------------------------------------------------
    def encode_interests(self, text: str) -> np.ndarray:
        """Encode a free-text interests string into a 384-dim float32 vector.

        Returns a zero vector for empty/None input or on any encoding error.
        """
        if text is None or (isinstance(text, str) and text.strip() == ""):
            logger.warning("encode_interests received empty text; returning zeros")
            return np.zeros(_EMBED_DIM, dtype=np.float32)

        try:
            vec = self._sentence_model.encode(text, convert_to_numpy=True)
            return vec.astype(np.float32)
        except Exception:  # noqa: BLE001 - non-fatal, degrade gracefully
            logger.error("encode_interests failed for text=%r", text, exc_info=True)
            return np.zeros(_EMBED_DIM, dtype=np.float32)

    # -- METHOD 2 -----------------------------------------------------------
    def compute_interest_similarity(
        self, vec_a: np.ndarray, vec_b: np.ndarray
    ) -> float:
        """Cosine similarity between two embedding vectors, clipped to [0, 1].

        Returns 0.0 if either vector is all zeros or has zero norm.
        """
        if not np.any(vec_a) or not np.any(vec_b):
            return 0.0

        dot = float(np.dot(vec_a, vec_b))
        norm_a = float(np.linalg.norm(vec_a))
        norm_b = float(np.linalg.norm(vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0

        similarity = dot / (norm_a * norm_b)
        return float(np.clip(similarity, 0.0, 1.0))

    # -- METHOD 3 -----------------------------------------------------------
    def extract_industry(
        self, company: Optional[str], designation: Optional[str]
    ) -> str:
        """Map a company + designation pair to an industry from the taxonomy.

        Layered strategy: keyword lookup, then spaCy NER re-check, then Unknown.
        """
        combined = f"{company or ''} {designation or ''}".lower().strip()
        if not combined:
            return "Unknown"

        # LAYER 1 — keyword lookup.
        for industry, keywords in _INDUSTRY_KEYWORDS.items():
            for kw in keywords:
                if kw in combined:
                    return industry

        # LAYER 2 — spaCy NER: inspect ORG entities, re-check a few lists.
        try:
            doc = self._nlp(combined)
            for ent in doc.ents:
                if ent.label_ != "ORG":
                    continue
                ent_text = ent.text.lower()
                for industry in _NER_RECHECK_INDUSTRIES:
                    for kw in _INDUSTRY_KEYWORDS[industry]:
                        if kw in ent_text:
                            return industry
        except Exception:  # noqa: BLE001 - NER is best-effort
            logger.warning("spaCy NER failed for %r", combined, exc_info=True)

        # LAYER 3 — default.
        return "Unknown"

    # -- METHOD 4 -----------------------------------------------------------
    def industry_compatibility_score(
        self, industry_a: str, industry_b: str
    ) -> int:
        """Score industry compatibility: same=2, adjacent=1, else 0.

        Returns 0 immediately if either industry is "Unknown".
        """
        if industry_a == "Unknown" or industry_b == "Unknown":
            return 0
        if industry_a == industry_b:
            return 2
        if industry_b in _INDUSTRY_ADJACENCY.get(industry_a, set()):
            return 1
        return 0

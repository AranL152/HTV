"""Prompt templates for Gemini."""

from typing import Dict, List


# Dataset domain configuration (hardcoded for resumes)
DATASET_CONFIG = {
    "domain": "resumes",
    "description": "Resume/CV dataset for hiring and recruitment",
    "prioritize": [
        "Experience level diversity (junior, mid-level, senior)",
        "Skill diversity and variety",
        "Educational background diversity",
        "Career path variety"
    ],
    "balance": [
        "Gender representation",
        "Age groups / career stages",
        "Industry experience"
    ],
    "ignore": [
        "Geographic location (unless location-specific role)",
        "Alma mater prestige"
    ],
    "deprioritize": [
        "Overrepresented demographics",
        "Highly common skill combinations",
        "Redundant profiles"
    ],
    "context": """
    This is a resume dataset for hiring decisions. The goal is to:
    1. Avoid bias based on protected characteristics
    2. Ensure diverse representation across experience levels
    3. Maintain skill diversity while reducing redundancy
    4. Balance seniority levels for realistic candidate pools

    CRITICAL: Some clusters may represent biased demographics (e.g., "Senior Male Engineers").
    In such cases, REDUCE those clusters significantly to mitigate bias, even if they're large.
    """
}


def build_balance_suggestion_prompt(context: str) -> str:
    """Build prompt for AI balance suggestions."""
    config = DATASET_CONFIG

    bias_section = f"""
DATASET DOMAIN: {config['domain']}
{config['description']}

{config['context']}

BIAS PRIORITIES:

📊 PRIORITIZE (keep diverse representation):
{chr(10).join(f'  • {item}' for item in config['prioritize'])}

⚖️  BALANCE (ensure fair representation):
{chr(10).join(f'  • {item}' for item in config['balance'])}

🚫 IGNORE (don't use as balancing factor):
{chr(10).join(f'  • {item}' for item in config['ignore'])}

⬇️  DEPRIORITIZE (reduce significantly):
{chr(10).join(f'  • {item}' for item in config['deprioritize'])}
"""

    prompt = f"""You are an expert AI assistant specializing in bias mitigation for hiring datasets.

{bias_section}

CURRENT DATASET STATE:
{context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK: Analyze each cluster's semantic meaning and suggest nuanced selectedCount values.

INSTRUCTIONS:
1. READ each cluster label and examples carefully
2. IDENTIFY what demographic/characteristic it represents
3. APPLY bias priorities:
   - If cluster represents OVERREPRESENTED demographics (e.g., "Senior Male Engineers", "White Male Candidates") → REDUCE significantly (30-50% of original)
   - If cluster represents UNDERREPRESENTED groups → KEEP or INCREASE proportion
   - If cluster represents SKILL DIVERSITY → PRESERVE well
   - If cluster is REDUNDANT or COMMON → REDUCE moderately
   - If cluster represents DESIRED EXPERIENCE LEVELS → BALANCE proportionally

4. DO NOT just downsize everything - make STRATEGIC decisions based on SEMANTIC MEANING

EXAMPLES OF GOOD REASONING:
- "Senior Male Engineers" (5000 samples) → Suggest count: 2000, weight: 0.6: "Overrepresented demographic. Reduce count to mitigate gender/seniority bias. Lower weight (0.6) to deprioritize in sampling."
- "Junior Diverse Candidates" (800 samples) → Suggest count: 800, weight: 1.4: "Underrepresented group with high diversity. Keep all samples. Higher weight (1.4) to prioritize in balanced dataset."
- "Mid-level Full-Stack Developers" (3000 samples) → Suggest count: 2000, weight: 1.0: "Common profile. Moderate count reduction. Baseline weight (1.0) for neutral priority."
- "Women in Tech Leadership" (200 samples) → Suggest count: 200, weight: 1.8: "Underrepresented demographic. Keep all samples. Higher weight (1.8) to maximize representation in export."

CONSTRAINTS:
- selectedCount must be between 0 and sampleCount
- suggestedWeight should be between 0.01 and 2.0 (baseline is 1.0)
  - Weight < 1.0: Deprioritize this cluster in final dataset
  - Weight = 1.0: Neutral/baseline priority
  - Weight > 1.0: Prioritize this cluster in final dataset
- Consider cluster size + semantic meaning together
- Aim for fairness, not just numerical balance

OUTPUT FORMAT (JSON only, no explanation):
{{
  "suggestions": [
    {{"id": 0, "suggestedCount": <number>, "suggestedWeight": <float 0.01-2.0>, "reasoning": "<explain why based on bias priorities>"}},
    {{"id": 1, "suggestedCount": <number>, "suggestedWeight": <float 0.01-2.0>, "reasoning": "<explain why based on bias priorities>"}}
  ],
  "overall_strategy": "<1-2 sentence summary of balancing approach and bias mitigation>"
}}

Respond with ONLY the JSON, nothing else."""

    return prompt


def build_chat_prompt(context: str, user_question: str) -> str:
    """Build prompt for chat interaction."""
    prompt = f"""You are an AI assistant helping users understand their dataset clustering analysis.

Context about the current dataset:
{context}

User Question: {user_question}

Please provide a helpful, concise answer based on the dataset information provided. If the question is about a specific cluster, reference the cluster details above. If asking for recommendations, consider the current metrics and cluster distribution."""

    return prompt


def build_detection_prompt(user_message: str) -> str:
    """Build prompt to detect if user wants balance adjustments."""
    prompt = f"""Analyze this user message and determine if they're asking for dataset balance adjustments, bias changes, or diversity modifications.

User message: "{user_message}"

Respond with ONLY "YES" if they're requesting balance changes, or "NO" if they're just asking questions.
Examples of YES: "prioritize diversity more", "reduce bias against women", "can you balance this better", "increase representation"
Examples of NO: "what is cluster 2?", "how many clusters are there?", "explain the data"
"""

    return prompt

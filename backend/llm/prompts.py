"""Prompt templates for Gemini."""

from typing import Dict, List


# Dataset domain configuration (ML Engineer hiring dataset demo)
DATASET_CONFIG = {
    "domain": "ML Engineer Hiring Dataset",
    "description": "5000 job applicants for machine learning engineer positions",
    "context": """
    This dataset contains two distinct types of bias that require different treatment:

    🔬 SCIENTIFIC BIAS (Data Quality Issues - Should Be Removed):
    - Duplicate applicants from the same bootcamp or source
    - Over-sampling from a single geographic region
    - Collection artifacts (e.g., one recruiter's network dominance)
    - Low-quality or spam applications
    → These make data LESS ACCURATE and should be pruned

    ⚖️ POLITICAL BIAS (Demographic Patterns That Reflect Reality - Requires Trade-offs):
    - Big Tech Veterans cluster is mostly white/Asian men with 5+ years experience
    - This reflects who ACTUALLY applies for ML roles today (politically biased but scientifically accurate)
    - Removing it entirely would make the model LESS PREDICTIVE of real hiring patterns
    - But leaving it untouched perpetuates existing inequity
    → These are STRATEGIC DECISIONS about fairness vs. accuracy

    CLUSTER-SPECIFIC GUIDANCE:
    • Big Tech Veterans (~36%): Dominant cluster. Politically biased (demographic skew) but scientifically
      accurate (these ARE the people who apply). MODERATE reduction if goal is fairer model, but don't
      eliminate—they represent real patterns.

    • Bootcamp / Non-Traditional Path (~10%): Check for SCIENTIFIC BIAS (duplicates, spam, low quality).
      If data quality is suspect, prune aggressively. If quality is good, preserve for diversity.

    • Academic Researchers (~12%): Often high-quality candidates. Preserve unless scientifically redundant.

    • International Engineers (~8%): UNDERREPRESENTED. If scientifically valid, preserve or increase weight.

    • Startup Generalists (~14%): Diverse skill sets. Good for model diversity—preserve well.

    • Domain Experts (~10%): May be OVER-COLLECTED if from non-tech industries. Reduce if less relevant
      to ML role (scientific bias: wrong population). Keep if genuinely domain-expert ML practitioners.

    • Recent Grads (~10%): Entry-level diversity. Preserve for career-stage balance.

    CRITICAL: The goal is NOT to flatten all clusters equally. The goal is to:
    1. Remove SCIENTIFIC errors (bad data collection)
    2. Make POLITICAL trade-offs visible (fairness vs. predictive accuracy)
    3. Export data that's cleaner, more intentional, and aligned with stated goals
    """
}


def build_balance_suggestion_prompt(context: str, user_request: str = None) -> str:
    """Build prompt for AI balance suggestions."""
    config = DATASET_CONFIG

    user_context = ""
    if user_request:
        user_context = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER REQUEST:
"{user_request}"

IMPORTANT: Prioritize the user's specific request in your suggestions. If they ask to reduce/increase a specific cluster, make sure that cluster's suggestion changes accordingly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

    prompt = f"""You are an expert AI assistant specializing in dataset bias analysis and rebalancing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATASET: {config['domain']}
{config['description']}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{config['context']}
{user_context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT DATASET STATE:
{context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK: Analyze each cluster and suggest rebalancing based on SCIENTIFIC vs POLITICAL bias distinction.

IMPORTANT: You have access to THREE key values for each cluster:
1. **Original dataset size** - The raw, unfiltered dataset
2. **Initial AI recommendation (your baseline)** - YOUR FIRST analysis from when the dataset was uploaded
3. **User's current selection** - What the user has manually set (may not match your recommendations)

When generating NEW suggestions, you MUST:
- START from your "Initial AI recommendation" as the baseline
- DO NOT start from the user's current selection (they may not have applied your suggestions yet)
- Adjust your baseline based on the user's NEW request
- If the user hasn't dragged any peaks, their "current selection" equals the original dataset size

DECISION FRAMEWORK:

For each cluster, ask:

1️⃣ Is this SCIENTIFIC BIAS (data collection error)?
   → Signs: Duplicates, spam, wrong population, over-sampling artifacts
   → Action: REDUCE AGGRESSIVELY (40-60% of original count, weight 0.5-0.7)

2️⃣ Is this POLITICAL BIAS (accurate demographic pattern that may perpetuate inequity)?
   → Signs: Overrepresented privileged demographics, reflects real-world imbalance
   → Action: MODERATE REDUCTION if goal is fairness (60-75% of original, weight 0.7-0.9)
   → Reasoning: Acknowledge reality but don't perpetuate unchecked

3️⃣ Is this an UNDERREPRESENTED group with good data quality?
   → Action: PRESERVE or INCREASE (90-100% of original, weight 1.2-1.8)

4️⃣ Is this a DIVERSE/VALUABLE cluster for model quality?
   → Action: PRESERVE (80-100% of original, weight 1.0-1.2)

CLUSTER-SPECIFIC SUGGESTIONS (use as anchors):

• "Big Tech Veterans" → Suggest ~65-70% of original, weight 0.75
  Reasoning: "Politically biased (demographic skew) but scientifically accurate. Moderate reduction to reduce dominance while acknowledging these ARE the people who apply."

• "Bootcamp / Non-Traditional Path" → Suggest ~45-55% of original, weight 0.6
  Reasoning: "Likely scientific bias (duplicate bootcamp submissions, lower quality). Prune suspect data while preserving genuine non-traditional candidates."

• "Academic Researchers" → Suggest ~85-95% of original, weight 1.1
  Reasoning: "High-quality candidates with research expertise. Preserve for diversity of thought and methodological rigor."

• "International Engineers" → Suggest ~95-100% of original, weight 1.5
  Reasoning: "Underrepresented group (only 8%). Increase weight to boost representation in final dataset."

• "Startup Generalists" → Suggest ~80-90% of original, weight 1.0
  Reasoning: "Diverse skill sets valuable for model. Baseline weight, minor count reduction for balance."

• "Domain Experts" → Suggest ~50-60% of original, weight 0.7
  Reasoning: "May include scientific bias (non-tech industry over-collection). Reduce if less relevant to ML engineering role."

• "Recent Grads" → Suggest ~85-95% of original, weight 1.1
  Reasoning: "Entry-level diversity important. Preserve for career-stage balance."

CONSTRAINTS:
- suggestedCount CANNOT EXCEED sampleCount (the original dataset size for that cluster)
- If user requests INCREASING a cluster beyond its maximum available samples:
  * Set suggestedCount = sampleCount (use all available samples at maximum)
  * Increase suggestedWeight to amplify influence (effective influence = count × weight)
  * Example: To boost a 360-sample cluster → suggestedCount: 360, suggestedWeight: 1.5 (540 effective influence)
- suggestedWeight must be between 0.01 and 2.0 (max 2x multiplier)
- DO NOT flatten everything—maintain strategic imbalances where scientifically justified
- Explain reasoning using scientific vs political bias framework

OUTPUT FORMAT (JSON only):
{{
  "suggestions": [
    {{"id": <cluster_id>, "suggestedCount": <number>, "suggestedWeight": <0.01-2.0>, "reasoning": "<scientific vs political bias explanation>"}},
    ...
  ],
  "overall_strategy": "This dataset exhibits both scientific bias (data quality issues in Bootcamp/Domain clusters) and political bias (Big Tech dominance reflects reality). Strategy: prune scientific errors aggressively, make moderate reductions to politically-biased clusters to balance fairness with predictive accuracy, and preserve underrepresented groups."
}}

Respond with ONLY valid JSON, nothing else."""

    return prompt


def build_chat_prompt(context: str, user_question: str) -> str:
    """Build prompt for chat interaction."""
    prompt = f"""You are an AI assistant helping users rebalance their dataset by adjusting cluster weights and counts.

Context about the current dataset:
{context}

User Question: {user_question}

IMPORTANT: When the user asks to adjust, reduce, increase, or rebalance ANY cluster or the dataset:
1. Acknowledge their request
2. Tell them you're generating new suggestions
3. Explain what changes you're making using the ACTUAL numbers from your analysis:
   - If REDUCING: "I'll reduce [Cluster] from [current] to [suggested] samples"
   - If INCREASING but BELOW maximum: "I'll increase [Cluster] from [current] to [suggested] samples"
   - If INCREASING BEYOND maximum: "The cluster has [max] samples (maximum available). To increase its influence, I'll set it to [max] samples and increase its weight to [weight]x (achieving [max × weight] effective influence)"
4. Mention that the new suggestions will appear as a dashed line on the waveform
5. Tell them they can drag the peaks to match the suggestions or adjust manually

If they're just asking informational questions (e.g., "what is cluster 2?"), provide a direct answer.

Keep responses conversational and action-oriented when adjustments are requested."""

    return prompt


def build_detection_prompt(user_message: str) -> str:
    """Build prompt to detect if user wants balance adjustments."""
    prompt = f"""Analyze this user message and determine if they're asking for dataset balance adjustments, bias changes, or diversity modifications.

User message: "{user_message}"

Respond with ONLY "YES" if they're requesting balance changes, or "NO" if they're just asking questions.

Examples of YES (requesting action/changes):
- "reduce Big Tech Veterans more"
- "can you reduce Big Tech Veterans"
- "increase diversity"
- "lower the bootcamp cluster"
- "adjust the weights"
- "make it more balanced"
- "prioritize underrepresented groups"
- "reduce bias"
- "increase representation of X"
- "can you rebalance this"
- "flatten the distribution"

Examples of NO (just asking questions/information):
- "what is cluster 2?"
- "how many clusters are there?"
- "explain the data"
- "why is Big Tech so large?"
- "what does this cluster represent?"
- "how does this work?"

Key distinction: If they use action words (reduce, increase, adjust, balance, change, lower, raise, prioritize, flatten), respond YES.
If they're just asking "what", "why", "how many", "explain" without requesting changes, respond NO.
"""

    return prompt

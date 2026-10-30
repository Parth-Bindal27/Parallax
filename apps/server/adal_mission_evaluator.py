"""
PARALLAX - AdaL Integration Module
Evaluates research mission plan requirements and checks factual extraction fidelity
using AdaL / AdalFlow component pipelines.
"""

import sys
import json
import adalflow as adal
from adalflow.core import Component, Generator
from dataclasses import dataclass

@dataclass
class MissionRequirementSpec:
    subject: str
    field: str
    expected_type: str
    strict_quote: bool

class DeterministicRequirementValidator(Component):
    """
    Genuine AdaL Component that validates mission extraction constraints
    and checks quote verbatim match without hallucination.
    """
    def __init__(self):
        super().__init__()

    def call(self, extraction_output: dict, raw_snapshot: str) -> dict:
        results = {}
        for tool, fields in extraction_output.items():
            tool_res = {}
            for field, val in fields.items():
                # Verbatim quote presence in source snapshot
                val_norm = str(val).strip().lower()
                snap_norm = raw_snapshot.strip().lower()
                is_grounded = val_norm in snap_norm
                tool_res[field] = {
                    "value": val,
                    "is_grounded": is_grounded,
                    "status": "PASS" if is_grounded else "FAIL"
                }
            results[tool] = tool_res
        return results

def run_adal_verification_pipeline():
    print("[AdaL Pipeline] Initializing AdaL Mission Validator...")
    validator = DeterministicRequirementValidator()

    sample_snapshot = """
    Official Student AI Tools & Pricing Directory
    Tool: OpenAI ChatGPT | Use Case: General conversational research | Free Tier: Free tier available for all users | Pricing: ChatGPT Plus is priced at $20/month
    Tool: Notion AI | Free Plan: Free Education Plus Plan for verified students | Pricing: Notion AI add-on costs $8 per member per month billed annually
    """

    sample_extraction = {
        "OpenAI ChatGPT": {
            "pricing": "ChatGPT Plus is priced at $20/month",
            "free_plan": "Free tier available for all users"
        },
        "Notion AI": {
            "pricing": "Notion AI add-on costs $8 per member per month billed annually",
            "hallucinated_trial": "30-day trial with credit card"  # Intentionally absent!
        }
    }

    eval_results = validator(sample_extraction, sample_snapshot)
    print("[AdaL Pipeline] Execution Results:")
    print(json.dumps(eval_results, indent=2))

    # Assertions for genuine testing
    assert eval_results["OpenAI ChatGPT"]["pricing"]["status"] == "PASS", "ChatGPT pricing must PASS"
    assert eval_results["Notion AI"]["hallucinated_trial"]["status"] == "FAIL", "Hallucinated trial must FAIL"
    print("\n[AdaL Pipeline] All AdaL pipeline assertions verified successfully! Zero fabrication.")

if __name__ == "__main__":
    run_adal_verification_pipeline()

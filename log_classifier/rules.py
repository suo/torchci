from pathlib import Path
from dataclasses import dataclass, asdict
import json


@dataclass
class Rule:
    name: str
    pattern: str
    priority: int


# Guidelines for writing rules:
# - Start with ^ if you can, it makes filtering out non-matching lines faster.
# - Try to make sure the produced "captures" field is useful:
#   - It should have enough information to identify the failure.
#   - It should be groupable; e.g. there should be no random noise in the capture group.
# - If no capture groups are specified, the "captures" field is the whole match.
#
# - Try to match against as much information as possible, so that captures are interesting.
#     For example, instead of 'error: ', do 'error: .*'
# - You can use capture groups to filter out line noise, so that we can aggregate on captures.
#     For example, for the failure 'FAIL [10.2s]: test_foo', 'test_foo' is a
#     good capture group, as it filters out test timings which might be
#     variable.
rules = [
    Rule("gtest failure", r"(^\[  FAILED  \].*) \(\d+", 1001),
    Rule(
        "No trailing spaces",
        r"^The above lines have trailing spaces; please remove them",
        1000,
    ),
    Rule(
        "GitHub workflows weren't regenerated",
        r"^As shown by the above diff, the committed \.github\/workflows",
        1000,
    ),
    Rule(
        "Docker image push failure",
        r"^name unknown: The repository with name '.*' does not exist in the registry",
        1001,
    ),
    Rule(
        "Windows PyLong API usage check",
        r"^Usage of PyLong_{From,As}{Unsigned}Long API may lead to overflow errors on Windows",
        1001,
    ),
    Rule(
        "NVIDIA installation failure", r"^ERROR: Installation has failed.*?nvidia", 1000
    ),
    Rule(
        "Python unittest error", r"FAIL \[.*\]: (test.*) \((?:__main__\.)?(.*)\)", 999
    ),
    Rule("MSVC out of memory", r"Catastrophic error: .*", 998),
    Rule("MSVC compiler error", r"^.*\(\d+\): error C\d+:.*", 999),
    Rule("Compile error", r"^.*\d+:\d+: error: .*", 997),
    Rule("Curl error", r"curl: .* error:", 996),
    Rule("Dirty checkout", r"^Build left local git repository checkout dirty", 995),
    Rule(
        "Docker manifest error",
        r"^ERROR: Something has gone wrong and the previous image isn't available for the merge-base of your branch",
        994,
    ),
    Rule("flake8 error", r"^.*:\d+:\d: [EBFW]\d+ .*", 800),
    Rule("Python AttributeError", r"^AttributeError: .*", 100),
    Rule("Python RuntimeError", r"^RuntimeError: .*", 99),
]

dict_rules = [asdict(rule) for rule in rules]

with open(Path(__file__).parent / "rules.json", "w") as f:
    json.dump(dict_rules, f, indent=4)

# Check roundtrip
with open(Path(__file__).parent / "rules.json", "r") as f:
    loaded_rules = json.load(f)
    loaded_rules = [Rule(**r) for r in loaded_rules]
    for i, loaded_rule in enumerate(loaded_rules):
        assert loaded_rule == rules[i]

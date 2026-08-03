#!/usr/bin/env python3
"""Build the browser-side BOU label overlay from the pinned British List fixture."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/national-bird-completion/source-cache/uk-bou-abc-2025.json"
OUTPUT = ROOT / "uk_bird_alias_completion_20260803.js"


def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows = [
        {
            "name": row["name"],
            "internationalName": row.get("internationalName", ""),
            "scientific": row["scientific"],
        }
        for row in source["species"]
    ]
    assert source["count"] == len(rows) == 636
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    output = f"""(function(root) {{
  'use strict';
  const rows = {payload};
  const normalise = value => String(value || '').split('(')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function applyToProfiles(profiles) {{
    const list = Array.isArray(profiles) ? profiles : [];
    const byLabel = new Map();
    const register = (label, profile) => {{
      const key = normalise(label);
      if (key && !byLabel.has(key)) byLabel.set(key, profile);
    }};
    list.forEach(profile => {{
      register(profile && profile.name, profile);
      register(profile && (profile.scientificName || profile.scientific), profile);
      (profile && profile.aliases || []).forEach(alias => register(alias, profile));
    }});

    const unresolved = [];
    const collisions = [];
    let aliasesAdded = 0;
    rows.forEach(row => {{
      const labels = [row.name, row.internationalName, row.scientific].filter(Boolean);
      const owners = [...new Set(labels.map(label => byLabel.get(normalise(label))).filter(Boolean))];
      const profile = owners[0];
      if (!profile) {{ unresolved.push(row.name); return; }}
      owners.forEach(owner => {{ if (!owner.scientificName && row.scientific) owner.scientificName = row.scientific; }});
      if (!Array.isArray(profile.aliases)) profile.aliases = [];
      labels.forEach(label => {{
        const key = normalise(label);
        const owner = byLabel.get(key);
        const sameTaxon = owner && normalise(owner.scientificName || owner.scientific) === normalise(row.scientific);
        if (owner && owner !== profile && !sameTaxon) {{ collisions.push(label); return; }}
        if (normalise(profile.name) !== key && !profile.aliases.some(alias => normalise(alias) === key)) {{
          profile.aliases.push(label);
          aliasesAdded += 1;
        }}
        register(label, profile);
      }});
    }});
    return {{ species: rows.length, aliasesAdded, unresolved, collisions }};
  }}

  root.BURBZ_UK_BIRD_ALIAS_COMPLETION_20260803 = Object.freeze({{
    source: 'BOU British List simple list, updated 11 December 2025',
    speciesCount: rows.length,
    rows,
    applyToProfiles
  }});
}})(typeof window !== 'undefined' ? window : globalThis);
"""
    OUTPUT.write_text(output, encoding="utf-8")
    print(f"wrote {OUTPUT.name} with {len(rows)} BOU species")


if __name__ == "__main__":
    main()

# Stand & World System Design Document

> "Your focus manifests. Your world responds."

This document outlines the design for Better Quest's signature feature: a **dynamic avatar ("Stand")** that evolves based on your stat distribution, living within an **ambient world** that grows and changes as you progress.

---

## Table of Contents

1. [Overview](#overview)
2. [The Stand System](#the-stand-system)
3. [The Ambient World](#the-ambient-world)
4. [How They Interact](#how-they-interact)
5. [Implementation Approaches](#implementation-approaches)
6. [Data Model](#data-model)
7. [Visual Design Guidelines](#visual-design-guidelines)
8. [Roadmap](#roadmap)

---

## Overview

### Core Philosophy

Traditional gamification shows you numbers going up. Better Quest shows you **who you're becoming**.

- Your **Stand** is the manifestation of your focus habits — not chosen, but _grown_
- Your **World** is the physical reflection of your journey — built session by session
- Together, they create a deeply personal, visual narrative of self-improvement

### Why This Matters

1. **Emotional Investment**: Users become attached to something they've grown, not selected
2. **Long-term Engagement**: The world evolves slowly, rewarding consistency over intensity
3. **Unique Identity**: No two users will have the same Stand or World
4. **Shareable**: "Look at my Stand!" is inherently more interesting than "Look at my stats!"

---

## The Stand System

### What is a Stand?

A Stand is a visual entity that represents the user's accumulated focus patterns. Inspired by JoJo's Bizarre Adventure, it's a spirit/companion that emerges from and reflects the user's journey.

### Stand Attributes

Each Stand has properties derived from user stats:

| Property        | Derived From                     | Example Range                                           |
| --------------- | -------------------------------- | ------------------------------------------------------- |
| **Form**        | Dominant stat(s)                 | Beast, Humanoid, Elemental, Abstract, Mechanical        |
| **Element**     | Secondary stat influence         | Fire, Water, Earth, Air, Lightning, Void, Light, Shadow |
| **Size**        | Total accumulated EXP            | Small wisp → Towering presence                          |
| **Complexity**  | Stat balance (spread vs focused) | Simple/pure → Complex/chimeric                          |
| **Aura Color**  | Stat combination signature       | RGB derived from stat ratios                            |
| **Personality** | Dominant stat + session patterns | Stoic, Playful, Fierce, Serene, Manic, etc.             |

### Stand Archetypes by Dominant Stat

| Stat    | Archetype    | Visual Direction                  | Personality                       |
| ------- | ------------ | --------------------------------- | --------------------------------- |
| **STR** | The Titan    | Muscular, armored, imposing       | Determined, direct, protective    |
| **DEX** | The Phantom  | Sleek, agile, multiple limbs      | Quick-witted, elusive, precise    |
| **STA** | The Colossus | Massive, sturdy, elemental        | Patient, enduring, immovable      |
| **INT** | The Oracle   | Geometric, eyes/symbols, floating | Analytical, distant, all-seeing   |
| **SPI** | The Seraph   | Ethereal, winged, luminous        | Calm, wise, transcendent          |
| **CRE** | The Muse     | Fluid, colorful, ever-shifting    | Playful, unpredictable, inspiring |
| **VIT** | The Guardian | Natural, healing aura, organic    | Nurturing, warm, restorative      |

### Hybrid Forms

When stats are balanced or multiple stats dominate, Stands become **chimeric**:

- **STR + INT**: The Philosopher King — armored scholar, tactical genius aesthetic
- **CRE + SPI**: The Dreamer — abstract, surreal, reality-bending appearance
- **DEX + VIT**: The Dancer — graceful, flowing, life-affirming energy
- **All balanced**: The Enigma — constantly shifting, unknowable, mirrors the viewer

### Stand Evolution Stages

1. **Spark** (0-1000 total EXP): A small wisp, barely visible
2. **Ember** (1000-5000 EXP): Takes rough form, colors emerge
3. **Flame** (5000-20000 EXP): Distinct features, personality shows
4. **Blaze** (20000-50000 EXP): Full form realized, aura visible
5. **Inferno** (50000+ EXP): Majestic, environment-affecting presence

### Stand Naming

Stands receive procedurally generated names based on:

- Session description keywords (weighted by frequency)
- Stat distribution pattern
- Time-of-day patterns (night owl vs early bird)
- Streak history

**Name structure**: `[Adjective] [Noun]` or `[The] [Title]`

Examples:

- "Crimson Discipline" (STR-dominant, consistent morning sessions)
- "The Wandering Algorithm" (INT-dominant, varied session topics)
- "Silent Thunder" (balanced STR+SPI, long sessions)

---

## The Ambient World

### What is the World?

A persistent, evolving environment that your Stand inhabits. Different regions grow or wither based on your stat investments.

### World Regions

The world is divided into 7 interconnected regions, each tied to a stat:

| Region                | Stat | Healthy State                      | Neglected State                |
| --------------------- | ---- | ---------------------------------- | ------------------------------ |
| **The Iron Peaks**    | STR  | Towering mountains, forges burning | Crumbling ruins, cold forges   |
| **The Swift Winds**   | DEX  | Racing clouds, aerial pathways     | Stagnant air, broken bridges   |
| **The Deep Roots**    | STA  | Ancient forests, mighty trees      | Withered stumps, barren soil   |
| **The Crystal Spire** | INT  | Gleaming library, floating tomes   | Dusty halls, faded texts       |
| **The Still Waters**  | SPI  | Serene temples, meditation pools   | Murky swamps, cracked shrines  |
| **The Painted Vale**  | CRE  | Vibrant gardens, impossible colors | Grey wasteland, wilted flowers |
| **The Warm Hearth**   | VIT  | Cozy villages, golden fields       | Abandoned homes, fallow land   |

### World Evolution Mechanics

Each region has a **vitality score** (0-100) based on recent stat investment:

```
region_vitality = (stat_exp_last_30_days / total_exp_last_30_days) * 100
```

Visual states based on vitality:

- **0-20**: Desolate (grey, broken, lifeless)
- **21-40**: Struggling (muted colors, decay visible)
- **41-60**: Stable (normal appearance)
- **61-80**: Thriving (vibrant, extra details)
- **81-100**: Flourishing (magical effects, rare features)

### Session Contributions

Each completed session adds visible elements to the world:

- **Short session (< 30 min)**: Small detail (flower, stone, candle)
- **Medium session (30-60 min)**: Notable feature (tree, statue, fountain)
- **Long session (60-120 min)**: Landmark (tower, grove, monument)
- **Epic session (120+ min)**: Wonder (floating island, aurora, ancient beast)

These persist and accumulate, creating a landscape of your journey.

### Seasonal/Time Effects

The world reflects real-world time:

- Day/night cycle synced to user's timezone
- Seasonal changes (visual variety, special events)
- Weather patterns based on recent activity (stormy during breaks, sunny during streaks)

---

## How They Interact

### Stand in World

Your Stand is always visible somewhere in your world:

- **Idle**: Roams regions based on recent focus (hangs out in areas you've built up)
- **During session**: Visibly working/training in the relevant region
- **After session**: Celebration animation, region grows
- **On streak**: Stand glows brighter, leaves trails

### World Affects Stand

- Stand appearance subtly shifts based on current world state
- In flourishing regions, Stand appears stronger
- In neglected regions, Stand appears concerned/motivated

### Narrative Beats

The system can generate micro-narratives:

> "Your Stand, Crimson Discipline, spent the morning training in the Iron Peaks. The forges burn bright today — STR region is thriving. But the Crystal Spire grows dim... perhaps it's time to return to study?"

---

## Implementation Approaches

### Approach A: AI Image Generation (Quick MVP)

**Pros:**

- Infinite visual variety
- Low upfront asset cost
- Can capture exact stat combinations

**Cons:**

- API costs per generation
- Inconsistent style without fine-tuning
- Latency on generation
- Less control over exact appearance

**Implementation:**

1. Build prompt templates based on stat distribution
2. Use Stable Diffusion, DALL-E, or Midjourney API
3. Cache generated images (Stand only regenerates on significant stat shifts)
4. Generate world as composite/layered (region backgrounds + overlays)

**Prompt Engineering Example:**

```javascript
function generateStandPrompt(stats, evolution, name) {
  const dominant = getDominantStat(stats);
  const archetype = ARCHETYPES[dominant];
  const complexity = getStatBalance(stats);

  return `
    A mystical spirit entity called "${name}", 
    ${archetype.form} with ${archetype.element} elements,
    ${evolution.size} presence, ${complexity} design,
    ethereal aura in ${calculateAuraColor(stats)},
    fantasy art style, detailed, glowing effects,
    dark background, dramatic lighting
  `;
}
```

### Approach B: 3D Asset Database (Robust Production)

**Pros:**

- Consistent visual style
- No per-generation cost
- Real-time rendering possible
- Full control over appearance
- Can animate smoothly

**Cons:**

- High upfront asset creation cost
- Limited to pre-made combinations
- Requires 3D artist(s)

**Implementation:**

1. Design modular Stand components (heads, bodies, limbs, auras, accessories)
2. Create region tile sets and objects (7 biomes × 4 states × variations)
3. Build composition system that assembles based on stats
4. Use Three.js or Unity for rendering
5. Export as sprites/images for React Native, or run WebGL view

**Asset Structure:**

```
/assets/stand/
  /base/
    titan.glb
    phantom.glb
    oracle.glb
    ...
  /elements/
    fire_aura.glb
    water_trails.glb
    ...
  /accessories/
    armor_set_1.glb
    wings_ethereal.glb
    ...

/assets/world/
  /iron_peaks/
    /desolate/
    /stable/
    /thriving/
    /flourishing/
  /crystal_spire/
    ...
```

### Approach C: Hybrid (Recommended)

1. **Stand**: Use AI generation for initial creation, then "lock in" favorites
2. **World**: Use pre-made 3D/2D assets for consistency
3. **Evolution**: Regenerate Stand at major milestones, keep world procedural

This balances novelty (unique Stands) with reliability (consistent world).

---

## Data Model

### Stand Schema

```typescript
interface Stand {
  id: string;
  userId: string;
  name: string;

  // Derived attributes (recalculated on stat changes)
  archetype:
    | "titan"
    | "phantom"
    | "colossus"
    | "oracle"
    | "seraph"
    | "muse"
    | "guardian"
    | "chimera";
  element:
    | "fire"
    | "water"
    | "earth"
    | "air"
    | "lightning"
    | "void"
    | "light"
    | "shadow";
  evolutionStage: 1 | 2 | 3 | 4 | 5;
  complexity: number; // 0-1, how balanced stats are
  auraColor: string; // hex color
  personality: string;

  // Visual
  imageUrl: string; // cached generated/composed image
  imageGeneratedAt: string; // ISO timestamp

  // Metadata
  createdAt: string;
  lastEvolvedAt: string;
}
```

### World Schema

```typescript
interface World {
  id: string;
  userId: string;

  regions: {
    ironPeaks: RegionState;
    swiftWinds: RegionState;
    deepRoots: RegionState;
    crystalSpire: RegionState;
    stillWaters: RegionState;
    paintedVale: RegionState;
    warmHearth: RegionState;
  };

  // Accumulated landmarks
  landmarks: Landmark[];

  // Current conditions
  timeOfDay: "dawn" | "day" | "dusk" | "night";
  weather: "clear" | "cloudy" | "rain" | "storm" | "magical";
  season: "spring" | "summer" | "autumn" | "winter";
}

interface RegionState {
  vitality: number; // 0-100
  totalExpContributed: number;
  lastSessionAt: string;
  visualState:
    | "desolate"
    | "struggling"
    | "stable"
    | "thriving"
    | "flourishing";
}

interface Landmark {
  id: string;
  region: string;
  type: "small" | "notable" | "landmark" | "wonder";
  sessionId: string; // what session created this
  description: string; // from session description
  createdAt: string;
  position: { x: number; y: number }; // placement in region
}
```

### Stat-to-Stand Calculation

```typescript
function calculateStandAttributes(avatar: Avatar): StandAttributes {
  const { standExp } = avatar;
  const total = Object.values(standExp).reduce((a, b) => a + b, 0);

  // Find dominant stat(s)
  const sorted = Object.entries(standExp).sort(([, a], [, b]) => b - a);

  const dominant = sorted[0][0];
  const secondary = sorted[1][0];
  const dominanceRatio = sorted[0][1] / (total || 1);

  // Determine archetype
  const archetype =
    dominanceRatio > 0.3 ? STAT_ARCHETYPES[dominant] : "chimera";

  // Calculate complexity (1 = perfectly balanced, 0 = single stat)
  const evenShare = total / 7;
  const variance =
    Object.values(standExp).reduce(
      (sum, val) => sum + Math.pow(val - evenShare, 2),
      0
    ) / 7;
  const complexity = 1 - Math.min(1, Math.sqrt(variance) / evenShare);

  // Derive aura color from stat ratios
  const auraColor = calculateAuraColor(standExp);

  // Evolution based on total EXP
  const evolutionStage = getEvolutionStage(avatar.totalExp);

  return {
    archetype,
    element: ARCHETYPE_ELEMENTS[archetype][secondary] || "void",
    evolutionStage,
    complexity,
    auraColor,
    personality: derivePersonality(
      archetype,
      complexity,
      avatar.sessionPatterns
    ),
  };
}
```

---

## Visual Design Guidelines

### Stand Aesthetics

- **Style**: Semi-realistic fantasy, ethereal/supernatural feel
- **Palette**: Rich, saturated colors with glowing accents
- **Mood**: Powerful but not threatening; a guardian, not a monster
- **Consistency**: Same art style across all archetypes

### World Aesthetics

- **Style**: Stylized, painterly, Studio Ghibli-inspired
- **Palette**: Warm and inviting when healthy, muted when neglected
- **Mood**: Cozy exploration, sense of wonder
- **Scale**: Stand should feel appropriately sized in the world

### Animation Priorities

1. Stand idle breathing/floating
2. Session start/complete celebrations
3. Region growth transitions
4. Stand moving between regions
5. Weather/time-of-day shifts

---

## Roadmap

### Phase 1: Foundation (MVP)

- [ ] Implement Stand attribute calculation from stats
- [ ] Basic Stand name generation
- [ ] Static placeholder images for each archetype
- [ ] Display Stand on home screen

### Phase 2: Stand Generation

- [ ] Integrate AI image generation API
- [ ] Build prompt templates for all archetypes
- [ ] Caching system for generated images
- [ ] Evolution stage visual differences

### Phase 3: World Foundation

- [ ] Design and create 2D region assets (7 regions × 4 states)
- [ ] Implement region vitality calculation
- [ ] Basic world view with region display
- [ ] Stand placement in world

### Phase 4: Living World

- [ ] Session → Landmark system
- [ ] Time-of-day sync
- [ ] Weather based on activity
- [ ] Seasonal changes

### Phase 5: Polish & Narrative

- [ ] Stand personality dialogue/tips
- [ ] Micro-narrative generation
- [ ] World exploration interaction
- [ ] Achievement system for world milestones

### Phase 6: Social Features

- [ ] Share Stand card
- [ ] Visit friends' worlds
- [ ] World comparison/inspiration
- [ ] Collaborative world events

---

## Open Questions

1. **Regeneration frequency**: How often should Stand image update? Every level? Every evolution stage? On demand?

2. **World persistence**: Should old landmarks ever disappear, or is the world purely additive?

3. **Multiple Stands**: Could advanced users unlock secondary Stands for different focus areas?

4. **World interaction**: Beyond viewing, can users interact with their world? Place landmarks manually? Name regions?

5. **NFT potential**: Are generated Stands/Worlds valuable enough to mint? Ethical considerations?

---

## Inspiration & References

- **JoJo's Bizarre Adventure**: Stand concept, naming conventions
- **Animal Crossing**: World building, daily engagement, seasonal content
- **Stardew Valley**: Farm/world as reflection of effort
- **Tamagotchi**: Care-based evolution, emotional attachment
- **Pokémon**: Evolution stages, type system
- **Journey**: Ethereal visuals, wordless narrative

---

_Document created: December 2024_
_Last updated: December 2024_
_Author: Claude (with human direction)_

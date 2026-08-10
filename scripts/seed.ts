import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { TONES } from "../lib/types";
import { DEFAULT_USER_EMAIL } from "../lib/db/queries/user";
import { resolveDatabaseUrl, defaultLocalDbUrl } from "../lib/config/app-config";

try {
  process.loadEnvFile();
} catch {
}

const url = resolveDatabaseUrl() ?? defaultLocalDbUrl();
const client = createClient({ url });
client.execute("PRAGMA foreign_keys = ON;").catch(() => {});
const db = drizzle(client, { schema });

const PRIORITIES = ["p1", "p2", "p3", null, "p2", "p4", null, "p3"] as const;

type TopicSeed = {
  title: string;
  summary: string;
  tags?: string[];
  decisions?: { title: string; note?: string }[];
};

type ProjectSeed = {
  title: string;
  tagline: string;
  color: string;
  topics: TopicSeed[];
  chain?: number[];
};

type SpaceSeed = {
  name: string;
  projects: ProjectSeed[];
};

function isoDay(base: Date, offsetDays: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date("2026-05-31");

const SPACES: SpaceSeed[] = [
  {
    name: "Personal",
    projects: [
      {
        title: "Home garden overhaul",
        tagline: "Turn the balcony and yard into something that grows",
        color: "#2A8C7A",
        chain: [0, 1, 2],
        topics: [
          {
            title: "Pick what to grow",
            summary: "Decide on the plant lineup, factoring in sun, season, and effort.",
            tags: ["planning", "plants"],
            decisions: [
              { title: "Choose 3 herbs for the first round", note: "Basil, mint, thyme — proven beginners." },
              { title: "Skip tomatoes this year", note: "Not enough afternoon sun on the east rail." },
              { title: "Reserve one bed for an experiment" },
            ],
          },
          {
            title: "Build raised beds",
            summary: "Two cedar beds along the south fence, knee height for easy reach.",
            tags: ["build", "setup"],
            decisions: [
              { title: "Buy cedar, not pressure-treated", note: "Food-safe and weathers nicely." },
              { title: "Line beds with hardware cloth", note: "Gophers." },
            ],
          },
          {
            title: "Irrigation plan",
            summary: "Drip lines on a timer so nothing dies during the August trip.",
            tags: ["setup", "water"],
          },
          { title: "Compost setup", summary: "Small tumbler by the shed; kitchen scraps + yard waste.", tags: ["setup"] },
          { title: "Soil testing", summary: "Get a pH + nutrient read before amending.", tags: ["research"] },
          { title: "Seasonal planting calendar", summary: "Map sow/transplant/harvest windows for the zone.", tags: ["planning"] },
          { title: "Tool storage shed", summary: "A small lean-to to keep tools dry and reachable.", tags: ["build"] },
          { title: "Pollinator corner", summary: "Native flowers to pull in bees for the squash.", tags: ["plants"] },
          { title: "Weekend build schedule", summary: "Sequence the work across four Saturdays.", tags: ["planning"] },
        ],
      },
    ],
  },
  {
    name: "Work",
    projects: [
      {
        title: "Mobile app v2",
        tagline: "The big rebuild — offline-first, faster, friendlier",
        color: "#3B7EA6",
        chain: [0, 1, 7, 15],
        topics: [
          {
            title: "Redesign onboarding flow",
            summary: "Cut steps from seven to three; show value before the signup wall.",
            tags: ["design", "growth"],
            decisions: [
              { title: "Defer account creation to step 3", note: "Let people try first." },
              { title: "Single-screen permission priming", note: "Explain before the OS prompt." },
            ],
          },
          {
            title: "Offline-first sync engine",
            summary: "Local writes are the source of truth; reconcile on reconnect.",
            tags: ["infra", "sync"],
            decisions: [
              { title: "Last-write-wins per field", note: "Simpler than CRDTs for v2 scope." },
              { title: "Queue mutations in SQLite" },
              { title: "Background sync on app foreground" },
            ],
          },
          { title: "Push notification overhaul", summary: "Category-based opt-in; kill the noisy defaults.", tags: ["growth"] },
          { title: "Dark mode parity", summary: "Audit every screen for contrast and token coverage.", tags: ["design", "a11y"] },
          { title: "Biometric login", summary: "Face/touch unlock with a PIN fallback.", tags: ["auth"] },
          { title: "In-app purchase tier", summary: "Single Pro tier; monthly + annual with a trial.", tags: ["revenue"] },
          { title: "Crash-free rate to 99.5%", summary: "Triage top crashers from the last release.", tags: ["quality"] },
          { title: "New tab bar IA", summary: "Four tabs max; move settings into profile.", tags: ["design", "ia"] },
          { title: "Search with filters", summary: "Type-ahead plus faceted filters for big libraries.", tags: ["search"] },
          { title: "Profile redesign", summary: "Consolidate identity, settings, and billing.", tags: ["design"] },
          { title: "Accessibility audit pass", summary: "VoiceOver/TalkBack sweep; fix labels and focus order.", tags: ["a11y", "quality"] },
          { title: "Deep link routing", summary: "Universal links that survive cold start.", tags: ["infra"] },
          { title: "Image upload compression", summary: "Client-side resize before upload to cut bandwidth.", tags: ["perf"] },
          { title: "Localization: 5 new languages", summary: "Extract strings, wire pluralization, RTL check.", tags: ["i18n"] },
          { title: "Home screen widget", summary: "Glanceable summary widget in two sizes.", tags: ["growth"] },
          { title: "Performance: cold start <1.5s", summary: "Defer non-critical init off the launch path.", tags: ["perf"] },
          { title: "Beta channel via TestFlight", summary: "Stand up a beta track with release notes flow.", tags: ["release"] },
          { title: "Analytics event taxonomy", summary: "One naming scheme so funnels actually line up.", tags: ["data"] },
        ],
      },
      {
        title: "Q3 Brand refresh",
        tagline: "Updating the visual identity ahead of the fall push",
        color: "#C8952A",
        chain: [0, 1, 8],
        topics: [
          {
            title: "New logotype exploration",
            summary: "Three directions: geometric, humanist, and a wordmark-only take.",
            tags: ["design"],
            decisions: [
              { title: "Drop the icon-only mark", note: "Wordmark reads better at small sizes." },
            ],
          },
          { title: "Color system refresh", summary: "Anchor palette plus accessible tints and shades.", tags: ["design"] },
          { title: "Typography scale", summary: "One display face, one text face, a modular scale.", tags: ["design"] },
          { title: "Voice & tone guidelines", summary: "How we sound: warm, plain, a little dry.", tags: ["content"] },
          { title: "Iconography set", summary: "A consistent 2px stroke icon family.", tags: ["design"] },
          { title: "Website hero redesign", summary: "Apply the new system to the marquee.", tags: ["web"] },
          { title: "Social templates", summary: "Reusable post and story templates.", tags: ["content"] },
          { title: "Email signature kit", summary: "Clean signatures for the whole team.", tags: ["ops"] },
          { title: "Brand book v1", summary: "Pull it all into one shareable document.", tags: ["design"] },
          { title: "Photography direction", summary: "Mood, lighting, and a shot list.", tags: ["content"] },
          { title: "Rollout plan & comms", summary: "Sequence the switch-over with minimal whiplash.", tags: ["planning", "ops"] },
        ],
      },
    ],
  },
  {
    name: "Side Projects",
    projects: [
      {
        title: "Indie game prototype",
        tagline: "A cozy survival-craft loop, built nights and weekends",
        color: "#7E5BB0",
        chain: [0, 1, 3, 10],
        topics: [
          {
            title: "Core loop: explore, craft, trade",
            summary: "Nail the 60-second loop before anything else.",
            tags: ["design", "gameplay"],
            decisions: [
              { title: "No combat in the first hour", note: "Lead with discovery." },
              { title: "Crafting unlocks gate exploration" },
            ],
          },
          { title: "Procedural map generation", summary: "Seeded islands with biomes and resource clusters.", tags: ["tech"] },
          { title: "Pixel art tileset v1", summary: "Ground, water, cliffs, and a dozen props.", tags: ["art"] },
          { title: "Save/load system", summary: "Serialize world + inventory; versioned saves.", tags: ["tech"] },
          { title: "Inventory UI", summary: "Grid with stacking, drag, and quick-move.", tags: ["ui"] },
          { title: "Day/night cycle", summary: "Lighting and spawn changes over a 20-min day.", tags: ["gameplay"] },
          { title: "Enemy AI states", summary: "Idle, wander, alert, flee — kept simple.", tags: ["tech", "gameplay"] },
          { title: "Crafting recipe tree", summary: "Tiered recipes that teach materials gradually.", tags: ["design"] },
          { title: "Sound design pass", summary: "Footsteps, ambience, and crafting feedback.", tags: ["audio"] },
          { title: "Controller support", summary: "Full gamepad mapping with UI focus states.", tags: ["tech"] },
          { title: "Tutorial island", summary: "A safe starter zone that teaches by doing.", tags: ["design"] },
          { title: "Boss fight: the Tide", summary: "An environmental boss tied to the day cycle.", tags: ["gameplay"] },
          { title: "Steam page draft", summary: "Capsule art, copy, and a wishlist hook.", tags: ["marketing"] },
          { title: "Playtest with 5 friends", summary: "Watch hands, don't explain, take notes.", tags: ["research"] },
          { title: "Music: ambient layers", summary: "Stems that swell with biome and time.", tags: ["audio"] },
          { title: "Settings & key rebinding", summary: "Resolution, audio sliders, remappable keys.", tags: ["ui"] },
        ],
      },
      {
        title: "Newsletter relaunch",
        tagline: "Dust it off, give it a name, ship four issues",
        color: "#C85B7E",
        chain: [0, 1],
        topics: [
          {
            title: "Pick a new platform",
            summary: "Compare on price, owned audience, and export.",
            tags: ["research"],
            decisions: [
              { title: "Own the subscriber list", note: "Must export without lock-in." },
            ],
          },
          { title: "Rename & rebrand", summary: "A name that survives a topic pivot.", tags: ["branding"] },
          { title: "Content pillars", summary: "Three recurring themes to rotate through.", tags: ["content"] },
          { title: "First 4 issues outline", summary: "Enough runway to find a rhythm.", tags: ["planning"] },
          { title: "Subscriber import", summary: "Clean the old list, re-permission where needed.", tags: ["ops"] },
          { title: "Launch announcement", summary: "Tease, launch, and a one-week follow-up.", tags: ["marketing"] },
        ],
      },
    ],
  },
];

async function main() {
  let [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_USER_EMAIL))
    .limit(1);
  if (!user) {
    [user] = await db.insert(schema.users).values({ email: DEFAULT_USER_EMAIL }).returning();
  }

  const deleted = await db
    .delete(schema.spaces)
    .where(eq(schema.spaces.userId, user.id))
    .returning();
  if (deleted.length > 0) {
    console.log(`Cleared ${deleted.length} existing space(s) before reseeding.`);
  }

  let toneIdx = 0;
  let prioIdx = 0;
  let dateOffset = 3;
  const allTags = new Set<string>();
  let topicCount = 0;
  let decisionCount = 0;
  let linkCount = 0;

  for (let s = 0; s < SPACES.length; s++) {
    const spaceSeed = SPACES[s];
    const [space] = await db
      .insert(schema.spaces)
      .values({ userId: user.id, name: spaceSeed.name, position: s })
      .returning();

    for (let p = 0; p < spaceSeed.projects.length; p++) {
      const projSeed = spaceSeed.projects[p];
      const [project] = await db
        .insert(schema.projects)
        .values({
          spaceId: space.id,
          title: projSeed.title,
          tagline: projSeed.tagline,
          color: projSeed.color,
          position: p,
        })
        .returning();

      const topicIds: string[] = [];

      for (let i = 0; i < projSeed.topics.length; i++) {
        const topicSeed = projSeed.topics[i];
        const tone = TONES[toneIdx++ % TONES.length];
        const priority = PRIORITIES[prioIdx++ % PRIORITIES.length];
        const tags = topicSeed.tags ?? [];
        tags.forEach((t) => allTags.add(t));

        const dated = i % 3 === 0;
        const startDate = dated ? isoDay(TODAY, dateOffset) : null;
        const endDate = dated ? isoDay(TODAY, dateOffset + 5) : null;
        if (dated) dateOffset += 4;
        const collapsed = i > 4 && i % 4 === 0;

        const [topic] = await db
          .insert(schema.topics)
          .values({
            projectId: project.id,
            title: topicSeed.title,
            summary: topicSeed.summary,
            tone,
            priority,
            tags,
            collapsed,
            position: i,
            startDate,
            endDate,
          })
          .returning();
        topicIds.push(topic.id);
        topicCount++;

        if (topicSeed.decisions?.length) {
          await db.insert(schema.decisions).values(
            topicSeed.decisions.map((d, di) => ({
              topicId: topic.id,
              title: d.title,
              note: d.note ?? "",
              position: di,
            })),
          );
          decisionCount += topicSeed.decisions.length;
        }
      }

      if (projSeed.chain && projSeed.chain.length > 1) {
        const edges = [];
        for (let c = 0; c < projSeed.chain.length - 1; c++) {
          const from = topicIds[projSeed.chain[c]];
          const to = topicIds[projSeed.chain[c + 1]];
          if (from && to) edges.push({ outbound: from, inbound: to });
        }
        if (edges.length) {
          await db.insert(schema.links).values(edges);
          linkCount += edges.length;
        }
      }
    }
  }

  const tagList = [...allTags].sort();
  await db
    .insert(schema.config)
    .values({ key: "all_tags", value: JSON.stringify(tagList) })
    .onConflictDoUpdate({ target: schema.config.key, set: { value: JSON.stringify(tagList) } });

  const projectCount = SPACES.reduce((n, s) => n + s.projects.length, 0);
  console.log(
    `Seeded: 1 user, ${SPACES.length} spaces, ${projectCount} projects, ${topicCount} topics, ${decisionCount} decisions, ${linkCount} links, ${tagList.length} tags.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    client.close();
  });

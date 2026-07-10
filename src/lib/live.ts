import { getSupabaseAnon, getSupabaseService } from "@/lib/supabase";
import { emptyFactorySnapshot, type FactorySnapshot } from "@/lib/factory/types";
import { loadFactorySnapshot } from "@/lib/factory/store";
import * as seed from "@/lib/data";

export type LiveBundle = {
  source: "supabase" | "seed";
  capturedAt: string | null;
  account: {
    handle: string;
    name: string;
    bio: string;
    plan: string;
    followers: number;
    following: number;
    tweets: number;
    likes: number;
    language: string;
    objective90d: string;
  };
  statusCards: typeof seed.statusCards;
  sparkFollowers: number[];
  sparkEngagement: number[];
  sparkPosts: number[];
  funnel: typeof seed.funnel;
  areas: typeof seed.areas;
  drafts: typeof seed.drafts;
  calendar: typeof seed.calendar;
  scheduleSlots: typeof seed.scheduleSlots;
  automations: typeof seed.automations;
  pipeline: typeof seed.pipeline;
  weeklyGoals: typeof seed.weeklyGoals;
  factory: FactorySnapshot;
};

function asNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadLiveBundle(): Promise<LiveBundle> {
  const sb = getSupabaseService() || getSupabaseAnon();
  if (!sb) {
    return {
      source: "seed",
      capturedAt: null,
      account: seed.account,
      statusCards: seed.statusCards,
      sparkFollowers: seed.sparkFollowers,
      sparkEngagement: seed.sparkEngagement,
      sparkPosts: seed.sparkPosts,
      funnel: seed.funnel,
      areas: seed.areas,
      drafts: seed.drafts,
      calendar: seed.calendar,
      scheduleSlots: seed.scheduleSlots,
      automations: seed.automations,
      pipeline: seed.pipeline,
      weeklyGoals: seed.weeklyGoals,
      factory: emptyFactorySnapshot,
    };
  }

  const [
    statusRes,
    metricsRes,
    areasRes,
    draftsRes,
    pipelineRes,
    scheduleRes,
    autosRes,
    calRes,
    factory,
  ] = await Promise.all([
    sb.from("mc_status").select("*").eq("id", "default").maybeSingle(),
    sb
      .from("mc_metrics")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("mc_areas").select("*"),
    sb.from("mc_drafts").select("*").order("updated_at", { ascending: false }),
    sb.from("mc_pipeline").select("*").order("sort_order"),
    sb.from("mc_schedule").select("*"),
    sb.from("mc_automations").select("*"),
    sb.from("mc_calendar_days").select("*").order("sort_order"),
    loadFactorySnapshot(sb),
  ]);

  const status = statusRes.data;
  const metrics = metricsRes.data;

  if (!status && !metrics && !areasRes.data?.length) {
    return {
      source: "seed",
      capturedAt: null,
      account: seed.account,
      statusCards: seed.statusCards,
      sparkFollowers: seed.sparkFollowers,
      sparkEngagement: seed.sparkEngagement,
      sparkPosts: seed.sparkPosts,
      funnel: seed.funnel,
      areas: seed.areas,
      drafts: seed.drafts,
      calendar: seed.calendar,
      scheduleSlots: seed.scheduleSlots,
      automations: seed.automations,
      pipeline: seed.pipeline,
      weeklyGoals: seed.weeklyGoals,
      factory: emptyFactorySnapshot,
    };
  }

  const followers = asNum(metrics?.followers, seed.account.followers);
  const following = asNum(metrics?.following, seed.account.following);
  const tweets = asNum(metrics?.tweets, seed.account.tweets);
  const likes = asNum(metrics?.likes, seed.account.likes);
  const posts7 = asNum(metrics?.posts_7d, 2);
  const replies7 = asNum(metrics?.replies_7d, 4);
  const pendingDrafts = (draftsRes.data || []).filter((d) =>
    ["pending", "draft", "in_review", "changes_requested"].includes(d.status),
  ).length;

  const sparkFollowers = (metrics?.spark_followers as number[]) || seed.sparkFollowers;
  const sparkEngagement =
    (metrics?.spark_engagement as number[]) || seed.sparkEngagement;
  const sparkPosts = (metrics?.spark_posts as number[]) || seed.sparkPosts;

  const impressions = asNum(metrics?.impressions_7d, 4200);
  const engagements = asNum(metrics?.engagements_7d, 186);
  const visits = asNum(metrics?.profile_visits_7d, 52);
  const dms = asNum(metrics?.dm_or_qualified_replies, 6);
  const leads = asNum(metrics?.leads_high_ticket, 1);

  const funnel = [
    { stage: "Impresiones 7d", value: impressions, pct: 100 },
    {
      stage: "Engagements",
      value: engagements,
      pct: Math.max(6, Math.round((engagements / Math.max(impressions, 1)) * 100)),
    },
    {
      stage: "Profile visits",
      value: visits,
      pct: Math.max(4, Math.round((visits / Math.max(impressions, 1)) * 100 * 8)),
    },
    {
      stage: "DMs / replies calif.",
      value: dms,
      pct: Math.max(3, Math.round((dms / Math.max(visits, 1)) * 100)),
    },
    {
      stage: "Leads high-ticket",
      value: leads,
      pct: Math.max(2, Math.round((leads / Math.max(dms, 1)) * 100)),
    },
  ];

  const areas = (areasRes.data || []).map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    description: a.description || "",
    priority: (a.priority === "side" ? "support" : a.priority) as
      | "core"
      | "growth"
      | "support",
    weeklyTarget: asNum(a.weekly_target, 1),
    doneThisWeek: asNum(a.done_this_week, 0),
  }));

  const drafts = (draftsRes.data || []).map((d) => ({
    id: d.id,
    title: d.title,
    preview: d.preview || "",
    status: d.status as seed.DraftStatus,
    language: d.language || "ES",
    area: d.area || "",
    source: d.source || "",
    updatedAt: (d.updated_at || "").slice(0, 10),
    score: asNum(d.score, 0),
  }));

  const pipeline = (pipelineRes.data || []).map((p) => ({
    id: p.id,
    label: p.label,
    count: asNum(p.count, 0),
    tone: (p.tone || "neutral") as "neutral" | "warn" | "good",
  }));

  const scheduleSlots = (scheduleRes.data || []).map((s) => ({
    id: s.id,
    when: s.when_label,
    title: s.title,
    status: s.status as "needs_approve" | "blocked" | "planned",
    channel: s.channel,
  }));

  const automations = (autosRes.data || []).map((a) => ({
    id: a.id,
    name: a.name,
    desc: a.description || "",
    enabled: !!a.enabled,
    cadence: a.cadence || "",
  }));

  const calendar = (calRes.data || []).map((c) => ({
    day: c.day_label,
    posts: asNum(c.posts, 0),
    replies: asNum(c.replies, 0),
    focus: c.focus || "",
  }));

  const livePipeline = pipeline.map((stage) => {
    const counts: Record<string, number> = {
      capture: factory.counts.capturesNew,
      scout: factory.counts.signalsNew,
      draft: factory.counts.draftsReview,
      approved: factory.counts.approved,
      scheduled: factory.counts.scheduled,
      posted: factory.counts.published,
    };
    return counts[stage.id] === undefined ? stage : { ...stage, count: counts[stage.id] };
  });

  const weeklyGoals = [
    { label: "Posts core", current: posts7, target: 5 },
    { label: "Replies valor", current: replies7, target: 15 },
    {
      label: "Capturas Solvers",
      current: livePipeline.find((p) => p.id === "capture")?.count || 0,
      target: 3,
    },
    {
      label: "Drafts aprobados",
      current: drafts.filter((d) => d.status === "approved" || d.status === "posted")
        .length,
      target: 5,
    },
  ];

  return {
    source: "supabase",
    capturedAt: metrics?.captured_at || status?.updated_at || null,
    account: {
      handle: status?.handle || seed.account.handle,
      name: seed.account.name,
      bio: status?.bio || seed.account.bio,
      plan: status?.plan || seed.account.plan,
      followers,
      following,
      tweets,
      likes,
      language: status?.language_policy || seed.account.language,
      objective90d: status?.objective_90d || seed.account.objective90d,
    },
    statusCards: [
      {
        label: "Followers",
        value: String(followers),
        hint: `tweets ${tweets}`,
        delta: 0,
      },
      {
        label: "Drafts pending",
        value: String(pendingDrafts),
        hint: "approve gate ON",
        delta: 0,
      },
      {
        label: "Posted 7d",
        value: String(posts7),
        hint: "target 7",
        delta: 0,
      },
      {
        label: "Replies 7d",
        value: String(replies7),
        hint: "target 15",
        delta: 0,
      },
    ],
    sparkFollowers,
    sparkEngagement,
    sparkPosts,
    funnel,
    areas: areas.length ? areas : seed.areas,
    drafts: drafts.length ? drafts : seed.drafts,
    calendar: calendar.length ? calendar : seed.calendar,
    scheduleSlots: factory.publications.length
      ? factory.publications.slice(0, 8).map((publication) => ({
          id: publication.id,
          when: new Date(publication.scheduledFor).toLocaleString("es-CO", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Bogota",
          }),
          title:
            factory.drafts.find((draft) => draft.id === publication.draftId)?.title ||
            "Publicación programada",
          status: publication.status as "needs_approve" | "blocked" | "planned",
          channel: "X post",
        }))
      : scheduleSlots.length
        ? scheduleSlots
        : seed.scheduleSlots,
    automations: automations.length ? automations : seed.automations,
    pipeline: livePipeline.length ? livePipeline : seed.pipeline,
    weeklyGoals,
    factory,
  };
}

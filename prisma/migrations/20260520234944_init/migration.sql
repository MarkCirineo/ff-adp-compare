-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "team" TEXT,
    "position" TEXT NOT NULL,
    "bye_week" INTEGER,
    "image_url" TEXT,
    "sleeper_id" TEXT,
    "espn_id" TEXT,
    "yahoo_id" TEXT,
    "fantasy_pros_id" TEXT,
    "external_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "pos_rank" TEXT,
    "format" TEXT NOT NULL DEFAULT 'redraft',
    "scoring" TEXT NOT NULL DEFAULT 'half_ppr',
    "season" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adp" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "adp" DOUBLE PRECISION NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'redraft',
    "scoring" TEXT NOT NULL DEFAULT 'half_ppr',
    "season" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projections" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "pts_std" DOUBLE PRECISION,
    "pts_half_ppr" DOUBLE PRECISION,
    "pts_ppr" DOUBLE PRECISION,
    "pass_yd" DOUBLE PRECISION,
    "pass_td" DOUBLE PRECISION,
    "rush_yd" DOUBLE PRECISION,
    "rush_td" DOUBLE PRECISION,
    "rec" DOUBLE PRECISION,
    "rec_yd" DOUBLE PRECISION,
    "rec_td" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "league_size" INTEGER NOT NULL DEFAULT 12,
    "draft_position" INTEGER NOT NULL DEFAULT 1,
    "scoring" TEXT NOT NULL DEFAULT 'half_ppr',
    "format" TEXT NOT NULL DEFAULT 'redraft',
    "roster" TEXT NOT NULL DEFAULT '1qb',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "players_found" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_sleeper_id_key" ON "players"("sleeper_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_espn_id_key" ON "players"("espn_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_yahoo_id_key" ON "players"("yahoo_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_fantasy_pros_id_key" ON "players"("fantasy_pros_id");

-- CreateIndex
CREATE INDEX "players_normalized_name_idx" ON "players"("normalized_name");

-- CreateIndex
CREATE INDEX "players_position_idx" ON "players"("position");

-- CreateIndex
CREATE INDEX "players_team_idx" ON "players"("team");

-- CreateIndex
CREATE INDEX "rankings_source_idx" ON "rankings"("source");

-- CreateIndex
CREATE INDEX "rankings_format_scoring_idx" ON "rankings"("format", "scoring");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_player_id_source_format_scoring_season_key" ON "rankings"("player_id", "source", "format", "scoring", "season");

-- CreateIndex
CREATE INDEX "adp_source_idx" ON "adp"("source");

-- CreateIndex
CREATE INDEX "adp_format_scoring_idx" ON "adp"("format", "scoring");

-- CreateIndex
CREATE UNIQUE INDEX "adp_player_id_source_format_scoring_season_key" ON "adp"("player_id", "source", "format", "scoring", "season");

-- CreateIndex
CREATE UNIQUE INDEX "projections_player_id_source_season_key" ON "projections"("player_id", "source", "season");

-- AddForeignKey
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adp" ADD CONSTRAINT "adp_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projections" ADD CONSTRAINT "projections_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

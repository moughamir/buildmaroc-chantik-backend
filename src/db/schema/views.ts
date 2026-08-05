import { sql } from 'drizzle-orm';
import { pgView } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { zones } from './projects';
import { capturePoints } from './projects';
import { panoramas } from './projects';
import { hotspots } from './projects';

export const projectHealthView = pgView('project_health_view').as((qb) => qb
  .select({
    projectId: projects.id,
    projectName: projects.name,
    organizationId: projects.organizationId,
    totalZones: sql<number>`count(distinct ${zones.id})`.as('total_zones'),
    totalCaptures: sql<number>`count(distinct ${panoramas.id})`.as('total_captures'),
    openIssues: sql<number>`count(${hotspots.id}) FILTER (WHERE ${hotspots.status} = 'issue')`.as('open_issues'),
    resolvedIssues: sql<number>`count(${hotspots.id}) FILTER (WHERE ${hotspots.status} = 'resolved')`.as('resolved_issues'),
  })
  .from(projects)
  .leftJoin(zones, sql`${projects.id} = ${zones.projectId}`)
  .leftJoin(capturePoints, sql`${zones.id} = ${capturePoints.zoneId}`)
  .leftJoin(panoramas, sql`${capturePoints.id} = ${panoramas.capturePointId}`)
  .leftJoin(hotspots, sql`${panoramas.id} = ${hotspots.panoramaId}`)
  .groupBy(projects.id)
);
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { WeeklyReportData } from '@/lib/db/weekly-report'

const COLOURS = {
  bg: '#0C0C14',
  card: '#1A1A28',
  border: '#2A2A3A',
  lime: '#B8FF00',
  white: '#FFFFFF',
  muted: '#9CA3AF',
  teal: '#2DD4BF',
  amber: '#FBBF24',
  purple: '#A78BFA',
  green: '#34D399',
  coral: '#FB7185',
  rose: '#FF4081',
} as const

const WORKSTREAM_COLOURS: Record<string, string> = {
  teal: COLOURS.teal,
  amber: COLOURS.amber,
  purple: COLOURS.purple,
  green: COLOURS.green,
  coral: COLOURS.coral,
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingRight: 36,
    paddingBottom: 50,
    paddingLeft: 36,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLOURS.white,
    backgroundColor: COLOURS.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  brand: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 3,
    color: COLOURS.lime,
  },
  weekLabel: {
    fontSize: 11,
    color: COLOURS.muted,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: COLOURS.white,
    marginBottom: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLOURS.lime,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLOURS.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLOURS.card,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: COLOURS.white,
  },
  statLabel: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOURS.muted,
    marginTop: 2,
  },
  wsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottom: `0.5 solid ${COLOURS.border}`,
  },
  wsLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: COLOURS.white,
  },
  wsStats: {
    flexDirection: 'row',
    gap: 12,
  },
  wsStat: {
    fontSize: 9,
    color: COLOURS.muted,
  },
  projRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottom: `0.5 solid ${COLOURS.border}`,
  },
  projName: {
    fontSize: 10,
    fontWeight: 700,
    color: COLOURS.white,
    maxWidth: '55%',
  },
  projMeta: {
    fontSize: 9,
    color: COLOURS.muted,
  },
  narrative: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLOURS.muted,
    backgroundColor: COLOURS.card,
    borderRadius: 8,
    padding: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `0.5 solid ${COLOURS.border}`,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: COLOURS.muted,
    letterSpacing: 1,
  },
})

function WeeklyReportDocument({ data }: { data: WeeklyReportData }) {
  const { taskSummary, workstreams, projectSummary, narrative, weekLabel } = data

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.brand}>TRAILHEAD OS</Text>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
        </View>

        <Text style={styles.title}>Weekly Report</Text>

        {/* Task stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TASK OVERVIEW</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{taskSummary.total}</Text>
              <Text style={styles.statLabel}>Open</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: COLOURS.lime }]}>{taskSummary.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{taskSummary.added}</Text>
              <Text style={styles.statLabel}>Added</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: taskSummary.overdue > 0 ? COLOURS.rose : COLOURS.white }]}>
                {taskSummary.overdue}
              </Text>
              <Text style={styles.statLabel}>Overdue</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: COLOURS.amber }]}>{taskSummary.dueSoon}</Text>
              <Text style={styles.statLabel}>Due Soon</Text>
            </View>
          </View>
        </View>

        {/* Workstreams */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WORKSTREAMS</Text>
          <View style={styles.card}>
            {workstreams.map((ws) => (
              <View key={ws.id} style={styles.wsRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: WORKSTREAM_COLOURS[ws.colour] ?? COLOURS.muted,
                    }}
                  />
                  <Text style={styles.wsLabel}>{ws.label}</Text>
                </View>
                <View style={styles.wsStats}>
                  <Text style={styles.wsStat}>{ws.openTasks} open</Text>
                  <Text style={[styles.wsStat, { color: COLOURS.lime }]}>
                    {ws.completedThisWeek} done
                  </Text>
                  {ws.overdue > 0 ? (
                    <Text style={[styles.wsStat, { color: COLOURS.rose }]}>
                      {ws.overdue} overdue
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Projects */}
        {projectSummary.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE PROJECTS</Text>
            <View style={styles.card}>
              {projectSummary.slice(0, 12).map((proj) => (
                <View key={proj.id} style={styles.projRow}>
                  <Text style={styles.projName}>{proj.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Text style={styles.projMeta}>
                      {proj.completed_task_count}/{proj.task_count} tasks
                    </Text>
                    {proj.next_milestone ? (
                      <Text style={[styles.projMeta, { color: COLOURS.amber }]}>
                        → {proj.next_milestone}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* AI Narrative */}
        {narrative ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI BRIEFING</Text>
            <Text style={styles.narrative}>{narrative}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>TRAILHEAD HOLDINGS LTD</Text>
          <Text style={styles.footerText}>
            Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderWeeklyReportPdf(data: WeeklyReportData): Promise<Buffer> {
  return renderToBuffer(<WeeklyReportDocument data={data} />) as Promise<Buffer>
}

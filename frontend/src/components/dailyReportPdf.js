import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const reportTime = (value, zone) => value ? new Intl.DateTimeFormat('en-IN', {
  timeZone: zone, dateStyle: 'medium', timeStyle: 'medium',
}).format(new Date(value)) : 'Not recorded'
export const label = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
export const metrics = [['received', 'Total Leads Received'], ['welcome', 'Welcome Calls Completed'], ['followUp', 'Follow-Ups Completed'], ['meeting', 'Meetings Conducted']]
export const DEFAULT_ACTIVITY_FILTER = 'CORE_ACTIVITIES'
export const activityFilterLabel = type => type === DEFAULT_ACTIVITY_FILTER ? 'Welcome Call, Follow Up & Meeting' : type ? label(type) : 'All activity types'
const coreActivityTypes = new Set(['WELCOME_CALL', 'FOLLOW_UP', 'MEETING'])
export const filterTimeline = (rows, search, type) => rows.filter(row => (!type || (type === DEFAULT_ACTIVITY_FILTER ? coreActivityTypes.has(row.type) : row.type === type)) && `${row.leadName} ${row.leadId}`.toLowerCase().includes(search.trim().toLowerCase()))

export const stageColors = {
  NEW: '#4f46e5', CONTACTED: '#7c3aed', QUALIFIED: '#2563eb',
  PROPOSAL: '#0891b2', NEGOTIATION: '#0f766e', WON: '#15803d', LOST: '#be123c',
}
export const stageColor = name => stageColors[name] || '#475569'
export const stageRgb = name => stageColor(name).slice(1).match(/../g).map(value => parseInt(value, 16))

export function buildDailyReportPdf(report, { search = '', type = DEFAULT_ACTIVITY_FILTER } = {}) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true })
  const navy = [20, 33, 61]
  const accent = [79, 70, 229]
  const width = 182
  const time = value => reportTime(value, report.timezone)
  const text = (value, x, y, size = 10, color = navy, maxWidth) => {
    doc.setFontSize(size); doc.setTextColor(...color)
    doc.text(maxWidth ? doc.splitTextToSize(String(value), maxWidth) : Array.isArray(value) ? value : String(value), x, y)
  }
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 43, 'F')
  text('INTERNITE CRM  /  DAILY INTELLIGENCE', 14, 13, 9, [165, 180, 252])
  text('Daily Lead Activity', 14, 25, 23, [255, 255, 255])
  text(`${report.date}  |  ${report.timezone}`, 14, 35, 10, [226, 232, 240])
  metrics.forEach(([key, title], index) => {
    const x = 14 + index * 46
    doc.setFillColor(245, 247, 252); doc.roundedRect(x, 51, 44, 27, 2, 2, 'F')
    text(report.kpis[key], x + 3, 63, 19, accent)
    text(title, x + 3, 70, 7, navy, 38)
  })
  text('Current lead pipeline', 14, 91, 14)
  text(`Snapshot: ${time(report.pipelineSnapshotAt)}`, 14, 98, 8)
  let y = 105
  report.pipeline.forEach((stage, index) => {
    const top = 154 - index * 12
    const bottom = top - 10
    const x = (210 - top) / 2
    doc.setFillColor(...stageRgb(stage.name))
    doc.lines([[top, 0], [(bottom - top) / 2, 10], [-bottom, 0], [(bottom - top) / 2, -10]], x, y, [1, 1], 'F', true)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9); doc.setTextColor(255, 255, 255)
    doc.text(`${label(stage.name)}  |  ${stage.count} leads  |  ${stage.percentage.toFixed(1)}%`, 105, y + 6, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    y += 12
  })
  y += 7
  text("Yesterday's new lead scoring", 14, y, 14)
  y += 8
  const scoreColors = { HOT: [239, 68, 68], WARM: [245, 158, 11], COLD: [59, 130, 246], UNCLASSIFIED: [148, 163, 184] }
  let left = 14
  report.scoring.forEach(score => {
    const w = width * score.percentage / 100
    if (w > 0) { doc.setFillColor(...scoreColors[score.name]); doc.rect(left, y, w, 7, 'F'); left += w }
  })
  y += 15
  report.scoring.forEach((score, index) => text(`${label(score.name)}: ${score.count} (${score.percentage.toFixed(1)}%)`, 14 + (index % 2) * 91, y + Math.floor(index / 2) * 7, 9))
  y += 23
  text(doc.splitTextToSize('Current pipeline distribution is not a historical conversion funnel. Activity counts cover all accessible leads, regardless of creation date.', width), 14, y, 8)
  doc.addPage()
  text('Lead history & activity', 14, 19, 17)
  const rows = filterTimeline(report.timeline, search, type)
  text(`${rows.length} records | Newest first | ${report.timezone}`, 14, 27, 9)
  const filters = `Lead search: ${search || 'All leads'} | Activity: ${activityFilterLabel(type)}`
  text(doc.splitTextToSize(filters, width), 14, 34, 8)
  const body = rows.map(row => [
    `${row.leadName || 'Unnamed lead'}\n${time(row.at)}\nLead ID: ${row.leadId}`,
    `${label(row.type)} | ${row.status || 'Recorded'}\n${row.previousStage || row.updatedStage ? `${row.previousStage || '?'} -> ${row.updatedStage || '?'}\n` : ''}${row.message || 'No message recorded.'}${row.nextFollowUp ? `\nNext follow-up: ${row.nextFollowUp}` : ''}`,
  ])
  autoTable(doc, {
    startY: 45, head: [['Lead / Date & time', 'Activity / What happened']], body,
    margin: { top: 16, bottom: 22, left: 14, right: 14 }, rowPageBreak: 'avoid',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', textColor: navy, lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] }, alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 59 }, 1: { cellWidth: 123 } },
    // Browser text shaping preserves Hindi and other Unicode messages that built-in PDF fonts cannot render.
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 0) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = accent; data.cell.styles.fillColor = [238, 242, 255] }
      if (data.section !== 'body' || !Array.from(String(data.cell.raw)).some(char => char.codePointAt(0) > 255 && !'–—‘’“”…•€'.includes(char))) return
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      context.font = '32px Arial, sans-serif'
      const max = ((data.column.index === 0 ? 59 : 123) - 8) * 32 / (8 * 25.4 / 72)
      const lines = []
      for (const paragraph of String(data.cell.raw).split('\n')) {
        let line = ''
        for (const word of paragraph.split(/\s+/)) {
          if (context.measureText(`${line} ${word}`.trim()).width > max && line) { lines.push(line); line = '' }
          for (const char of word) {
            if (context.measureText(line + char).width > max) { lines.push(line); line = '' }
            line += char
          }
          line += ' '
        }
        lines.push(line.trimEnd())
      }
      data.cell.text = lines
      data.cell.styles.overflow = 'visible'
      data.cell._unicode = true
    },
    willDrawCell: data => {
      if (!data.cell._unicode) return
      data.cell._renderLines = data.cell.text
      data.cell.text = []
    },
    didDrawCell: data => {
      if (!data.cell._unicode) return
      const lines = data.cell._renderLines
      const scale = 32 / (8 * 25.4 / 72)
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil((data.cell.width - 8) * scale)
      canvas.height = Math.ceil(lines.length * 8 * 1.15 * 25.4 / 72 * scale + 12)
      const context = canvas.getContext('2d')
      context.font = '32px Arial, sans-serif'; context.fillStyle = '#14213d'; context.textBaseline = 'top'
      lines.forEach((line, i) => context.fillText(line, 0, i * 32 * 1.15))
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', data.cell.x + 4, data.cell.y + 4, canvas.width / scale, canvas.height / scale, undefined, 'FAST')
      data.cell.text = lines
    },
  })
  if (!rows.length) text('No matching activity was recorded on this reporting day.', 14, 61, 10)
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(226, 232, 240); doc.line(14, 279, 196, 279)
    text(`Report: ${report.date} | Generated: ${time(report.generatedAt)}`, 14, 285, 7)
    text(`${page} / ${pages}`, 183, 285, 8)
  }
  return doc
}

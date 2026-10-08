export const RT = {
  Ready: 'realtime.ready',
  MachineStatusChanged: 'machine.status_changed',
  PieceCompleted: 'production.piece_completed',
  IssueOpened: 'issue.opened',
  IssueAcknowledged: 'issue.acknowledged',
  IssueResolved: 'issue.resolved',
  WorkOrderUpdated: 'work_order.updated',
} as const;
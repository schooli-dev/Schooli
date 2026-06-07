import { pool } from "../../db/pool.js";

export type AdminDashboardStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
    teachers: number;
    students: number;
    support: number;
  };
  classes: {
    today: number;
    live: number;
    upcoming: number;
    completedThisMonth: number;
  };
  tickets: {
    open: number;
    urgent: number;
  };
  homework: {
    pending: number;
    overdue: number;
  };
  credits: {
    approvedTotal: number;
  };
  todaysClasses: Array<{
    id: string;
    title: string;
    teacherName: string;
    studentName: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
  }>;
  openTickets: Array<{
    id: string;
    subject: string;
    priority: string;
    status: string;
    createdAt: Date;
  }>;
};

type UserStatsRow = {
  total: string;
  active: string;
  inactive: string;
  teachers: string;
  students: string;
  support: string;
};

type ClassStatsRow = {
  today: string;
  live: string;
  upcoming: string;
  completed_this_month: string;
};

type TicketStatsRow = {
  open: string;
  urgent: string;
};

type HomeworkStatsRow = {
  pending: string;
  overdue: string;
};

type CreditStatsRow = {
  approved_total: string | null;
};

type TodayClassRow = {
  id: string;
  title: string;
  teacher_name: string;
  student_name: string | null;
  start_time: Date;
  end_time: Date;
  status: string;
};

type OpenTicketRow = {
  id: string;
  subject: string;
  priority: string;
  status: string;
  created_at: Date;
};

export async function getStats(): Promise<AdminDashboardStats> {
  const [users, classes, tickets, homework, credits, todaysClasses, openTickets] = await Promise.all([
    getUserStats(),
    getClassStats(),
    getTicketStats(),
    getHomeworkStats(),
    getCreditStats(),
    getTodaysClasses(),
    getOpenTickets()
  ]);

  return {
    users,
    classes,
    tickets,
    homework,
    credits,
    todaysClasses,
    openTickets
  };
}

async function getUserStats(): Promise<AdminDashboardStats["users"]> {
  const result = await pool.query<UserStatsRow>(`
    SELECT
      COUNT(*)::TEXT AS total,
      COUNT(*) FILTER (WHERE u.status = 'active' AND u.is_active = TRUE)::TEXT AS active,
      COUNT(*) FILTER (WHERE u.status <> 'active' OR u.is_active = FALSE)::TEXT AS inactive,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.name = 'teacher'
      ))::TEXT AS teachers,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.name = 'student'
      ))::TEXT AS students,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.name = 'support'
      ))::TEXT AS support
    FROM users u
  `);

  const row = result.rows[0];

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    inactive: Number(row?.inactive ?? 0),
    teachers: Number(row?.teachers ?? 0),
    students: Number(row?.students ?? 0),
    support: Number(row?.support ?? 0)
  };
}

async function getClassStats(): Promise<AdminDashboardStats["classes"]> {
  const result = await pool.query<ClassStatsRow>(`
    SELECT
      COUNT(*) FILTER (WHERE c.start_time::DATE = CURRENT_DATE)::TEXT AS today,
      COUNT(*) FILTER (WHERE c.status = 'live')::TEXT AS live,
      COUNT(*) FILTER (WHERE c.start_time > NOW() AND c.status IN ('scheduled', 'rescheduled'))::TEXT AS upcoming,
      COUNT(*) FILTER (
        WHERE c.status = 'completed'
          AND date_trunc('month', c.end_time) = date_trunc('month', NOW())
      )::TEXT AS completed_this_month
    FROM classes c
  `);

  const row = result.rows[0];

  return {
    today: Number(row?.today ?? 0),
    live: Number(row?.live ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
    completedThisMonth: Number(row?.completed_this_month ?? 0)
  };
}

async function getTicketStats(): Promise<AdminDashboardStats["tickets"]> {
  const result = await pool.query<TicketStatsRow>(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('open', 'assigned', 'in_progress', 'escalated'))::TEXT AS open,
      COUNT(*) FILTER (WHERE priority = 'urgent' AND status IN ('open', 'assigned', 'in_progress', 'escalated'))::TEXT AS urgent
    FROM tickets
  `);

  const row = result.rows[0];

  return {
    open: Number(row?.open ?? 0),
    urgent: Number(row?.urgent ?? 0)
  };
}

async function getHomeworkStats(): Promise<AdminDashboardStats["homework"]> {
  const result = await pool.query<HomeworkStatsRow>(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('assigned', 'submitted'))::TEXT AS pending,
      COUNT(*) FILTER (WHERE status = 'overdue' OR (due_date < NOW() AND status = 'assigned'))::TEXT AS overdue
    FROM homework
  `);

  const row = result.rows[0];

  return {
    pending: Number(row?.pending ?? 0),
    overdue: Number(row?.overdue ?? 0)
  };
}

async function getCreditStats(): Promise<AdminDashboardStats["credits"]> {
  const result = await pool.query<CreditStatsRow>(`
    SELECT COALESCE(SUM(amount) FILTER (WHERE approval_status = 'approved'), 0)::TEXT AS approved_total
    FROM credits_ledger
  `);

  return {
    approvedTotal: Number(result.rows[0]?.approved_total ?? 0)
  };
}

async function getTodaysClasses(): Promise<AdminDashboardStats["todaysClasses"]> {
  const result = await pool.query<TodayClassRow>(`
    SELECT
      c.id,
      c.title,
      CONCAT(teacher.first_name, ' ', teacher.last_name) AS teacher_name,
      CONCAT(student.first_name, ' ', student.last_name) AS student_name,
      c.start_time,
      c.end_time,
      c.status
    FROM classes c
    JOIN users teacher ON teacher.id = c.teacher_id
    LEFT JOIN class_participants cp ON cp.class_id = c.id
    LEFT JOIN users student ON student.id = cp.student_id
    WHERE c.start_time::DATE = CURRENT_DATE
    ORDER BY c.start_time ASC
    LIMIT 5
  `);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    teacherName: row.teacher_name,
    studentName: row.student_name,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status
  }));
}

async function getOpenTickets(): Promise<AdminDashboardStats["openTickets"]> {
  const result = await pool.query<OpenTicketRow>(`
    SELECT id, subject, priority, status, created_at
    FROM tickets
    WHERE status IN ('open', 'assigned', 'in_progress', 'escalated')
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      created_at DESC
    LIMIT 5
  `);

  return result.rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at
  }));
}

import { pool } from "../../db/pool.js";

type CurriculumStatus = "active" | "inactive";

// ---------------------------------------------------------------------------------------------
// Curriculum analytics: structural counts only (courses/modules/classes/teacher access).
// Student/teacher progress metrics belong to the other Reports & Analytics sections, not here.
// ---------------------------------------------------------------------------------------------

type CurriculumSummaryRow = {
  total_courses: string;
  total_modules: string;
  active_modules: string;
  inactive_modules: string;
  total_classes: string;
};

export async function getCurriculumSummary() {
  const result = await pool.query<CurriculumSummaryRow>(`
    SELECT
      (SELECT COUNT(*) FROM curriculum_courses)::TEXT AS total_courses,
      (SELECT COUNT(*) FROM curriculum_modules)::TEXT AS total_modules,
      (SELECT COUNT(*) FROM curriculum_modules WHERE status = 'active')::TEXT AS active_modules,
      (SELECT COUNT(*) FROM curriculum_modules WHERE status = 'inactive')::TEXT AS inactive_modules,
      (SELECT COUNT(*) FROM classes WHERE curriculum_lesson_id IS NOT NULL)::TEXT AS total_classes
  `);
  const row = result.rows[0];
  return {
    totalCourses: Number(row.total_courses),
    totalModules: Number(row.total_modules),
    activeModules: Number(row.active_modules),
    inactiveModules: Number(row.inactive_modules),
    totalClasses: Number(row.total_classes)
  };
}

type FilterCourseRow = { id: string; name: string };
type FilterModuleRow = { id: string; name: string; course_id: string; status: CurriculumStatus };

export async function getCurriculumFilters() {
  const [courses, modules] = await Promise.all([
    pool.query<FilterCourseRow>(`SELECT id, name FROM curriculum_courses ORDER BY LOWER(name)`),
    pool.query<FilterModuleRow>(`SELECT id, name, course_id, status FROM curriculum_modules ORDER BY LOWER(name)`)
  ]);
  return {
    courses: courses.rows.map((course) => ({ id: course.id, name: course.name })),
    modules: modules.rows.map((module) => ({ id: module.id, name: module.name, courseId: module.course_id, status: module.status }))
  };
}

type ModuleAnalyticsRow = {
  module_id: string;
  module_name: string;
  module_status: CurriculumStatus;
  course_id: string;
  course_name: string;
  classes_count: string;
  teachers_assigned_count: string;
};

const moduleSortColumns: Record<string, string> = {
  courseName: "LOWER(c.name), m.sort_order",
  moduleName: "LOWER(m.name)",
  classesDesc: "classes_count DESC, LOWER(c.name)",
  teachersDesc: "teachers_assigned_count DESC, LOWER(c.name)"
};

export async function listCurriculumModuleAnalytics(query: {
  courseId?: string;
  moduleId?: string;
  status?: "all" | CurriculumStatus;
  sort?: string;
}) {
  const orderBy = moduleSortColumns[query.sort ?? "courseName"] ?? moduleSortColumns.courseName;
  const result = await pool.query<ModuleAnalyticsRow>(
    `
      SELECT
        m.id AS module_id, m.name AS module_name, m.status AS module_status,
        c.id AS course_id, c.name AS course_name,
        COUNT(DISTINCT cl.id)::TEXT AS classes_count,
        COUNT(DISTINCT tma.teacher_id) FILTER (WHERE tma.is_active)::TEXT AS teachers_assigned_count
      FROM curriculum_modules m
      JOIN curriculum_courses c ON c.id = m.course_id
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      LEFT JOIN classes cl ON cl.curriculum_lesson_id = l.id
      LEFT JOIN teacher_module_access tma ON tma.module_id = m.id
      WHERE ($1::UUID IS NULL OR c.id = $1::UUID)
        AND ($2::UUID IS NULL OR m.id = $2::UUID)
        AND ($3 = 'all' OR m.status = $3::curriculum_status)
      GROUP BY m.id, c.id
      ORDER BY ${orderBy}
    `,
    [query.courseId ?? null, query.moduleId ?? null, query.status ?? "all"]
  );
  return result.rows.map((row) => ({
    moduleId: row.module_id,
    moduleName: row.module_name,
    status: row.module_status,
    courseId: row.course_id,
    courseName: row.course_name,
    classesCount: Number(row.classes_count),
    teachersAssignedCount: Number(row.teachers_assigned_count)
  }));
}

type ModuleTeacherClassRow = {
  teacher_id: string;
  teacher_name: string;
  assigned_at: Date;
  class_id: string | null;
  class_status: string | null;
  start_time: Date | null;
  lesson_number: number | null;
  lesson_title: string | null;
  student_id: string | null;
  student_name: string | null;
};

export async function getModuleTeacherProgress(moduleId: string) {
  const result = await pool.query<ModuleTeacherClassRow>(
    `
      SELECT
        tma.teacher_id, BTRIM(CONCAT(u.first_name, ' ', u.last_name)) AS teacher_name, tma.granted_at AS assigned_at,
        c.id AS class_id, c.status AS class_status, c.start_time,
        cl.lesson_number, cl.title AS lesson_title,
        cp.student_id, BTRIM(CONCAT(su.first_name, ' ', su.last_name)) AS student_name
      FROM teacher_module_access tma
      JOIN users u ON u.id = tma.teacher_id
      LEFT JOIN classes c ON c.teacher_id = tma.teacher_id
        AND c.curriculum_lesson_id IN (SELECT id FROM curriculum_lessons WHERE module_id = $1)
      LEFT JOIN curriculum_lessons cl ON cl.id = c.curriculum_lesson_id
      LEFT JOIN class_participants cp ON cp.class_id = c.id
      LEFT JOIN users su ON su.id = cp.student_id
      WHERE tma.module_id = $1 AND tma.is_active = TRUE
      ORDER BY LOWER(u.first_name), LOWER(u.last_name), c.start_time
    `,
    [moduleId]
  );

  type TeacherGroup = {
    teacherId: string;
    teacherName: string;
    assignedAt: Date;
    classIds: Set<string>;
    completedClassIds: Set<string>;
    scheduledClasses: {
      classId: string;
      lessonNumber: number | null;
      lessonTitle: string | null;
      studentName: string | null;
      status: string;
      startTime: Date;
    }[];
  };

  const groups = new Map<string, TeacherGroup>();
  for (const row of result.rows) {
    let group = groups.get(row.teacher_id);
    if (!group) {
      group = { teacherId: row.teacher_id, teacherName: row.teacher_name, assignedAt: row.assigned_at, classIds: new Set(), completedClassIds: new Set(), scheduledClasses: [] };
      groups.set(row.teacher_id, group);
    }
    if (row.class_id) {
      group.classIds.add(row.class_id);
      if (row.class_status === "completed") group.completedClassIds.add(row.class_id);
      group.scheduledClasses.push({
        classId: row.class_id,
        lessonNumber: row.lesson_number,
        lessonTitle: row.lesson_title,
        studentName: row.student_name,
        status: row.class_status as string,
        startTime: row.start_time as Date
      });
    }
  }

  return {
    teachers: Array.from(groups.values()).map((group) => ({
      teacherId: group.teacherId,
      teacherName: group.teacherName,
      assignedAt: group.assignedAt,
      classesScheduled: group.classIds.size,
      classesCompleted: group.completedClassIds.size,
      scheduledClasses: group.scheduledClasses
    }))
  };
}

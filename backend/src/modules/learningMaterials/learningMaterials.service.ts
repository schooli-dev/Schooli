import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { createInAppNotifications } from "../notifications/notifications.service.js";

type CurriculumStatus = "active" | "inactive";

type CourseRow = {
  id: string;
  name: string;
  description: string | null;
  icon_key: string;
  icon_url: string | null;
  status: CurriculumStatus;
  created_at: Date;
  updated_at: Date;
  module_count: string;
  lesson_count: string;
};

type ModuleRow = {
  id: string;
  course_id: string;
  course_name: string;
  name: string;
  description: string | null;
  sort_order: number;
  status: CurriculumStatus;
  created_at: Date;
  updated_at: Date;
  lesson_count: string;
  teacher_count: string;
};

type TeacherRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  timezone: string;
};

type TeacherAccessRow = TeacherRow & { module_ids: string[] };
type TeacherAccessSummaryRow = TeacherRow & { module_count: string; course_count: string; module_ids: string[] };

type LessonPreviewRow = {
  id: string;
  lesson_number: number;
  title: string;
  status: CurriculumStatus;
  material_count: string;
};

type CourseInput = {
  name: string;
  description?: string | null;
  iconKey?: string;
  iconUrl?: string | null;
  status?: CurriculumStatus;
};

type ModuleInput = {
  courseId: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  status?: CurriculumStatus;
};

type LessonInput = { moduleId: string; lessonNumber: number; title: string; description?: string | null; sortOrder: number; status?: CurriculumStatus };
type MaterialInput = {
  lessonId: string; section: "presentation" | "lesson_plan" | "homework" | "file"; sourceType: "file" | "link"; title: string;
  fileUrl?: string; storageKey?: string; fileName?: string; mimeType?: string; sizeBytes?: number; externalUrl?: string;
  audience?: "teachers_only" | "students_and_teachers"; allowLateSubmission?: boolean;
};

type LessonRow = { id: string; module_id: string; module_name: string; course_id: string; course_name: string; lesson_number: number; title: string; description: string | null; sort_order: number; status: CurriculumStatus; created_at: Date; updated_at: Date; material_count: string };
type MaterialRow = { id: string; logical_id: string; lesson_id: string; section: string; source_type: string; title: string; file_url: string | null; storage_key: string | null; file_name: string | null; mime_type: string | null; size_bytes: string | null; external_url: string | null; audience: string; allow_late_submission: boolean; version: number; status: CurriculumStatus; replaces_material_id: string | null; created_at: Date; updated_at: Date };

export async function listCourses(query: { search?: string; status?: "all" | CurriculumStatus }) {
  const result = await pool.query<CourseRow>(
    `
      SELECT
        c.id, c.name, c.description, c.icon_key, c.icon_url, c.status, c.created_at, c.updated_at,
        COUNT(DISTINCT m.id)::TEXT AS module_count,
        COUNT(DISTINCT l.id)::TEXT AS lesson_count
      FROM curriculum_courses c
      LEFT JOIN curriculum_modules m ON m.course_id = c.id
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%' OR COALESCE(c.description, '') ILIKE '%' || $1 || '%')
        AND ($2 = 'all' OR c.status = $2::curriculum_status)
      GROUP BY c.id
      ORDER BY CASE WHEN c.status = 'active' THEN 0 ELSE 1 END, LOWER(c.name)
    `,
    [query.search?.trim() ?? "", query.status ?? "all"]
  );

  return result.rows.map(mapCourse);
}

export async function createCourse(input: CourseInput, actor: AuthenticatedUser) {
  try {
    const result = await pool.query<CourseRow>(
      `
        INSERT INTO curriculum_courses (name, description, icon_key, icon_url, status, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING id, name, description, icon_key, icon_url, status, created_at, updated_at, '0'::TEXT AS module_count, '0'::TEXT AS lesson_count
      `,
      [input.name, input.description ?? null, input.iconKey ?? "bi-code-slash", input.iconUrl ?? null, input.status ?? "active", actor.id]
    );
    return mapCourse(result.rows[0]);
  } catch (error) {
    handleUniqueViolation(error, "A course with this name already exists", "COURSE_ALREADY_EXISTS");
    throw error;
  }
}

export async function getCourse(id: string) {
  const course = await getCourseRow(id);
  const modules = await pool.query<ModuleRow>(
    `
      SELECT
        m.id, m.course_id, c.name AS course_name, m.name, m.description, m.sort_order, m.status, m.created_at, m.updated_at,
        COUNT(DISTINCT l.id)::TEXT AS lesson_count,
        COUNT(DISTINCT tma.teacher_id) FILTER (WHERE tma.is_active)::TEXT AS teacher_count
      FROM curriculum_modules m
      JOIN curriculum_courses c ON c.id = m.course_id
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      LEFT JOIN teacher_module_access tma ON tma.module_id = m.id
      WHERE m.course_id = $1
      GROUP BY m.id, c.name
      ORDER BY m.sort_order, LOWER(m.name)
    `,
    [id]
  );

  return { ...mapCourse(course), modules: modules.rows.map(mapModule) };
}

export async function updateCourse(id: string, input: Partial<CourseInput>, actor: AuthenticatedUser) {
  await getCourseRow(id);
  const values: unknown[] = [];
  const assignments: string[] = [];
  addUpdate(assignments, values, "name", input.name);
  addUpdate(assignments, values, "description", input.description);
  addUpdate(assignments, values, "icon_key", input.iconKey);
  addUpdate(assignments, values, "icon_url", input.iconUrl);
  addUpdate(assignments, values, "status", input.status);
  values.push(actor.id, id);

  try {
    const result = await pool.query<CourseRow>(
      `
        UPDATE curriculum_courses
        SET ${assignments.join(", ")}, updated_by_user_id = $${values.length - 1}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id, name, description, icon_key, icon_url, status, created_at, updated_at,
          (SELECT COUNT(*)::TEXT FROM curriculum_modules WHERE course_id = curriculum_courses.id) AS module_count,
          (SELECT COUNT(*)::TEXT FROM curriculum_lessons l JOIN curriculum_modules m ON m.id = l.module_id WHERE m.course_id = curriculum_courses.id) AS lesson_count
      `,
      values
    );
    return mapCourse(result.rows[0]);
  } catch (error) {
    handleUniqueViolation(error, "A course with this name already exists", "COURSE_ALREADY_EXISTS");
    throw error;
  }
}

export async function listModules(query: { search?: string; courseId?: string; status?: "all" | CurriculumStatus; sort?: string }) {
  const orderBy: Record<string, string> = {
    order: "m.sort_order, LOWER(m.name)",
    name: "LOWER(m.name)",
    createdAt: "m.created_at DESC",
    updatedAt: "m.updated_at DESC"
  };
  const result = await pool.query<ModuleRow>(
    `
      SELECT
        m.id, m.course_id, c.name AS course_name, m.name, m.description, m.sort_order, m.status, m.created_at, m.updated_at,
        COUNT(DISTINCT l.id)::TEXT AS lesson_count,
        COUNT(DISTINCT tma.teacher_id) FILTER (WHERE tma.is_active)::TEXT AS teacher_count
      FROM curriculum_modules m
      JOIN curriculum_courses c ON c.id = m.course_id
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      LEFT JOIN teacher_module_access tma ON tma.module_id = m.id
      WHERE ($1 = '' OR m.name ILIKE '%' || $1 || '%' OR COALESCE(m.description, '') ILIKE '%' || $1 || '%')
        AND ($2::UUID IS NULL OR m.course_id = $2::UUID)
        AND ($3 = 'all' OR m.status = $3::curriculum_status)
      GROUP BY m.id, c.name
      ORDER BY ${orderBy[query.sort ?? "order"] ?? orderBy.order}
    `,
    [query.search?.trim() ?? "", query.courseId ?? null, query.status ?? "all"]
  );
  return result.rows.map(mapModule);
}

export async function createModule(input: ModuleInput, actor: AuthenticatedUser) {
  await assertActiveCourse(input.courseId);
  try {
    const result = await pool.query<ModuleRow>(
      `
        INSERT INTO curriculum_modules (course_id, name, description, sort_order, status, created_by_user_id, updated_by_user_id)
        SELECT $1, $2, $3, $4, $5, $6, $6
        FROM curriculum_courses c WHERE c.id = $1
        RETURNING id, course_id, (SELECT name FROM curriculum_courses WHERE id = course_id) AS course_name,
          name, description, sort_order, status, created_at, updated_at, '0'::TEXT AS lesson_count, '0'::TEXT AS teacher_count
      `,
      [input.courseId, input.name, input.description ?? null, input.sortOrder, input.status ?? "active", actor.id]
    );
    return mapModule(result.rows[0]);
  } catch (error) {
    handleUniqueViolation(error, "Module name and order must be unique within the selected course", "MODULE_CONFLICT");
    throw error;
  }
}

export async function getModule(id: string) {
  const module = await getModuleRow(id);
  const [teachers, lessons] = await Promise.all([
    pool.query<TeacherRow>(
      `
        SELECT u.id, u.first_name, u.last_name, u.email, u.timezone
        FROM teacher_module_access tma
        JOIN users u ON u.id = tma.teacher_id
        WHERE tma.module_id = $1 AND tma.is_active = TRUE
        ORDER BY LOWER(u.first_name), LOWER(u.last_name)
      `,
      [id]
    ),
    pool.query<LessonPreviewRow>(
      `
        SELECT l.id, l.lesson_number, l.title, l.status, COUNT(cm.id)::TEXT AS material_count
        FROM curriculum_lessons l
        LEFT JOIN curriculum_materials cm ON cm.lesson_id = l.id AND cm.status = 'active'
        WHERE l.module_id = $1
        GROUP BY l.id
        ORDER BY l.sort_order, l.lesson_number
        LIMIT 10
      `,
      [id]
    )
  ]);

  return {
    ...mapModule(module),
    teachers: teachers.rows.map((teacher) => ({
      id: teacher.id,
      fullName: `${teacher.first_name} ${teacher.last_name}`.trim(),
      email: teacher.email,
      timezone: teacher.timezone
    })),
    lessons: lessons.rows.map((lesson) => ({
      id: lesson.id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
      status: lesson.status,
      materialCount: Number(lesson.material_count)
    }))
  };
}

export async function updateModule(id: string, input: Partial<ModuleInput>, actor: AuthenticatedUser) {
  await getModuleRow(id);
  if (input.courseId) await assertActiveCourse(input.courseId);
  const values: unknown[] = [];
  const assignments: string[] = [];
  addUpdate(assignments, values, "course_id", input.courseId);
  addUpdate(assignments, values, "name", input.name);
  addUpdate(assignments, values, "description", input.description);
  addUpdate(assignments, values, "sort_order", input.sortOrder);
  addUpdate(assignments, values, "status", input.status);
  values.push(actor.id, id);
  try {
    await pool.query(
      `UPDATE curriculum_modules SET ${assignments.join(", ")}, updated_by_user_id = $${values.length - 1}, updated_at = NOW() WHERE id = $${values.length}`,
      values
    );
  } catch (error) {
    handleUniqueViolation(error, "Module name and order must be unique within the selected course", "MODULE_CONFLICT");
    throw error;
  }
  return getModule(id);
}

export async function replaceModuleTeachers(moduleId: string, teacherIds: string[], actor: AuthenticatedUser) {
  const module = await getModuleRow(moduleId);
  if (module.status !== "active") {
    throw new ApiError(409, "Teacher access cannot be changed for an inactive module", "MODULE_INACTIVE");
  }
  const uniqueTeacherIds = [...new Set(teacherIds)];
  if (uniqueTeacherIds.length) await assertActiveTeachers(uniqueTeacherIds);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ teacher_id: string }>(
      "SELECT teacher_id FROM teacher_module_access WHERE module_id = $1 AND is_active = TRUE FOR UPDATE",
      [moduleId]
    );
    const existingTeacherIds = existing.rows.map((row) => row.teacher_id);
    await client.query(
      `
        UPDATE teacher_module_access
        SET is_active = FALSE, updated_at = NOW()
        WHERE module_id = $1
          AND is_active = TRUE
          AND NOT (teacher_id = ANY($2::UUID[]))
      `,
      [moduleId, uniqueTeacherIds]
    );
    for (const teacherId of uniqueTeacherIds) {
      await client.query(
        `
          INSERT INTO teacher_module_access (teacher_id, module_id, is_active, granted_by_user_id, granted_at, updated_at)
          VALUES ($1, $2, TRUE, $3, NOW(), NOW())
          ON CONFLICT (teacher_id, module_id) DO UPDATE
          SET is_active = TRUE, granted_by_user_id = EXCLUDED.granted_by_user_id, granted_at = NOW(), updated_at = NOW()
        `,
        [teacherId, moduleId, actor.id]
      );
    }

    await notifyModuleAccessChanges(client, moduleId, uniqueTeacherIds.filter((id) => !existingTeacherIds.includes(id)), existingTeacherIds.filter((id) => !uniqueTeacherIds.includes(id)));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getModule(moduleId);
}

export async function getTeacherModules(teacherId: string) {
  const result = await pool.query<TeacherAccessRow>(
    `
      SELECT u.id, u.first_name, u.last_name, u.email, u.timezone,
             COALESCE(
               ARRAY_AGG(tma.module_id) FILTER (WHERE tma.is_active AND m.status = 'active'),
               '{}'::UUID[]
             )::TEXT[] AS module_ids
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.name = 'teacher'
      LEFT JOIN teacher_module_access tma ON tma.teacher_id = u.id
      LEFT JOIN curriculum_modules m ON m.id = tma.module_id
      WHERE u.id = $1
        AND u.is_active = TRUE
        AND u.status = 'active'
      GROUP BY u.id
    `,
    [teacherId]
  );
  const teacher = result.rows[0];
  if (!teacher) throw new ApiError(404, "Active teacher not found", "TEACHER_NOT_FOUND");

  return {
    teacher: {
      id: teacher.id,
      fullName: `${teacher.first_name} ${teacher.last_name}`.trim(),
      email: teacher.email,
      timezone: teacher.timezone
    },
    moduleIds: teacher.module_ids
  };
}

export async function listTeacherAccess() {
  const result = await pool.query<TeacherAccessSummaryRow>(
    `
      SELECT u.id, u.first_name, u.last_name, u.email, u.timezone,
             COUNT(DISTINCT m.id) FILTER (WHERE tma.is_active AND m.status = 'active')::TEXT AS module_count,
             COUNT(DISTINCT m.course_id) FILTER (WHERE tma.is_active AND m.status = 'active')::TEXT AS course_count,
             COALESCE(
               ARRAY_AGG(DISTINCT m.id) FILTER (WHERE tma.is_active AND m.status = 'active'),
               '{}'::UUID[]
             )::TEXT[] AS module_ids
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.name = 'teacher'
      LEFT JOIN teacher_module_access tma ON tma.teacher_id = u.id
      LEFT JOIN curriculum_modules m ON m.id = tma.module_id
      WHERE u.is_active = TRUE
        AND u.status = 'active'
      GROUP BY u.id
      ORDER BY LOWER(u.first_name), LOWER(u.last_name)
    `
  );

  return result.rows.map((teacher) => ({
    id: teacher.id,
    fullName: `${teacher.first_name} ${teacher.last_name}`.trim(),
    email: teacher.email,
    timezone: teacher.timezone,
    moduleCount: Number(teacher.module_count),
    courseCount: Number(teacher.course_count),
    moduleIds: teacher.module_ids
  }));
}

export async function replaceTeacherModules(teacherId: string, moduleIds: string[], actor: AuthenticatedUser) {
  await assertActiveTeachers([teacherId]);
  const uniqueModuleIds = [...new Set(moduleIds)];
  if (uniqueModuleIds.length) await assertActiveModules(uniqueModuleIds);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ module_id: string }>(
      "SELECT module_id FROM teacher_module_access WHERE teacher_id = $1 AND is_active = TRUE FOR UPDATE",
      [teacherId]
    );
    const existingModuleIds = existing.rows.map((row) => row.module_id);

    await client.query(
      `
        UPDATE teacher_module_access
        SET is_active = FALSE, updated_at = NOW()
        WHERE teacher_id = $1
          AND is_active = TRUE
          AND NOT (module_id = ANY($2::UUID[]))
      `,
      [teacherId, uniqueModuleIds]
    );

    for (const moduleId of uniqueModuleIds) {
      await client.query(
        `
          INSERT INTO teacher_module_access (teacher_id, module_id, is_active, granted_by_user_id, granted_at, updated_at)
          VALUES ($1, $2, TRUE, $3, NOW(), NOW())
          ON CONFLICT (teacher_id, module_id) DO UPDATE
          SET is_active = TRUE, granted_by_user_id = EXCLUDED.granted_by_user_id, granted_at = NOW(), updated_at = NOW()
        `,
        [teacherId, moduleId, actor.id]
      );
    }

    await notifyTeacherAccessChanges(
      client,
      teacherId,
      uniqueModuleIds.filter((id) => !existingModuleIds.includes(id)),
      existingModuleIds.filter((id) => !uniqueModuleIds.includes(id))
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getTeacherModules(teacherId);
}

export async function listLessons(query: { moduleId?: string; status?: "all" | CurriculumStatus }) {
  const result = await pool.query<LessonRow>(
    `
      SELECT l.id, l.module_id, m.name AS module_name, m.course_id, c.name AS course_name, l.lesson_number, l.title, l.description,
        l.sort_order, l.status, l.created_at, l.updated_at, COUNT(cm.id)::TEXT AS material_count
      FROM curriculum_lessons l
      JOIN curriculum_modules m ON m.id = l.module_id
      JOIN curriculum_courses c ON c.id = m.course_id
      LEFT JOIN curriculum_materials cm ON cm.lesson_id = l.id AND cm.status = 'active'
      WHERE ($1::UUID IS NULL OR l.module_id = $1::UUID) AND ($2 = 'all' OR l.status = $2::curriculum_status)
      GROUP BY l.id, m.name, m.course_id, m.sort_order, c.name
      ORDER BY c.name, m.sort_order, l.sort_order, l.lesson_number
    `,
    [query.moduleId ?? null, query.status ?? "all"]
  );
  return result.rows.map(mapLesson);
}

export async function createLesson(input: LessonInput, actor: AuthenticatedUser) {
  await assertActiveModule(input.moduleId);
  try {
    const result = await pool.query<LessonRow>(
      `
        INSERT INTO curriculum_lessons (module_id, lesson_number, title, description, sort_order, status, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING id, module_id, (SELECT name FROM curriculum_modules WHERE id = module_id) AS module_name,
          (SELECT course_id FROM curriculum_modules WHERE id = module_id) AS course_id,
          (SELECT c.name FROM curriculum_courses c JOIN curriculum_modules m ON m.course_id = c.id WHERE m.id = module_id) AS course_name,
          lesson_number, title, description, sort_order, status, created_at, updated_at, '0'::TEXT AS material_count
      `,
      [input.moduleId, input.lessonNumber, input.title, input.description ?? null, input.sortOrder, input.status ?? "active", actor.id]
    );
    return mapLesson(result.rows[0]);
  } catch (error) {
    handleUniqueViolation(error, "Lesson number and order must be unique within the selected module", "LESSON_CONFLICT");
    throw error;
  }
}

export async function getLesson(id: string) {
  const lesson = await getLessonRow(id);
  const materials = await pool.query<MaterialRow>(
    `SELECT id, logical_id, lesson_id, section, source_type, title, file_url, storage_key, file_name, mime_type, size_bytes, external_url, audience, allow_late_submission, version, status, replaces_material_id, created_at, updated_at FROM curriculum_materials WHERE lesson_id = $1 ORDER BY section, logical_id, version DESC`,
    [id]
  );
  return { ...mapLesson(lesson), materials: materials.rows.map(mapMaterial) };
}

export async function updateLesson(id: string, input: Partial<LessonInput>, actor: AuthenticatedUser) {
  await getLessonRow(id);
  if (input.moduleId) await assertActiveModule(input.moduleId);
  const values: unknown[] = [];
  const assignments: string[] = [];
  addUpdate(assignments, values, "module_id", input.moduleId);
  addUpdate(assignments, values, "lesson_number", input.lessonNumber);
  addUpdate(assignments, values, "title", input.title);
  addUpdate(assignments, values, "description", input.description);
  addUpdate(assignments, values, "sort_order", input.sortOrder);
  addUpdate(assignments, values, "status", input.status);
  values.push(actor.id, id);
  try {
    await pool.query(`UPDATE curriculum_lessons SET ${assignments.join(", ")}, updated_by_user_id = $${values.length - 1}, updated_at = NOW() WHERE id = $${values.length}`, values);
  } catch (error) {
    handleUniqueViolation(error, "Lesson number and order must be unique within the selected module", "LESSON_CONFLICT");
    throw error;
  }
  return getLesson(id);
}

export async function createMaterial(input: MaterialInput, actor: AuthenticatedUser) {
  await assertActiveLesson(input.lessonId);
  const result = await pool.query<MaterialRow>(
    `
      INSERT INTO curriculum_materials (lesson_id, section, source_type, title, file_url, storage_key, file_name, mime_type, size_bytes, external_url, audience, allow_late_submission, created_by_user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, logical_id, lesson_id, section, source_type, title, file_url, storage_key, file_name, mime_type, size_bytes, external_url, audience, allow_late_submission, version, status, replaces_material_id, created_at, updated_at
    `,
    [input.lessonId, input.section, input.sourceType, input.title, input.fileUrl ?? null, input.storageKey ?? null, input.fileName ?? null, input.mimeType ?? null, input.sizeBytes ?? null, input.externalUrl ?? null, input.audience ?? "teachers_only", input.allowLateSubmission ?? false, actor.id]
  );
  return mapMaterial(result.rows[0]);
}

export async function createMaterialRevision(materialId: string, input: Omit<MaterialInput, "lessonId">, actor: AuthenticatedUser) {
  const current = await pool.query<MaterialRow>(
    `SELECT id, logical_id, lesson_id, section, source_type, title, file_url, storage_key, file_name, mime_type, size_bytes, external_url, audience, allow_late_submission, version, status, replaces_material_id, created_at, updated_at FROM curriculum_materials WHERE id = $1`,
    [materialId]
  );
  if (!current.rows[0]) throw new ApiError(404, "Learning material not found", "MATERIAL_NOT_FOUND");
  await assertActiveLesson(current.rows[0].lesson_id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE curriculum_materials SET status = 'inactive', updated_at = NOW() WHERE id = $1", [materialId]);
    const revision = await client.query<MaterialRow>(
      `
        INSERT INTO curriculum_materials (logical_id, lesson_id, section, source_type, title, file_url, storage_key, file_name, mime_type, size_bytes, external_url, audience, allow_late_submission, version, status, replaces_material_id, created_by_user_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16)
        RETURNING id, logical_id, lesson_id, section, source_type, title, file_url, storage_key, file_name, mime_type, size_bytes, external_url, audience, allow_late_submission, version, status, replaces_material_id, created_at, updated_at
      `,
      [current.rows[0].logical_id, current.rows[0].lesson_id, input.section, input.sourceType, input.title, input.fileUrl ?? null, input.storageKey ?? null, input.fileName ?? null, input.mimeType ?? null, input.sizeBytes ?? null, input.externalUrl ?? null, input.audience ?? "teachers_only", input.allowLateSubmission ?? false, current.rows[0].version + 1, materialId, actor.id]
    );
    await client.query("COMMIT");
    return mapMaterial(revision.rows[0]);
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function getCourseRow(id: string): Promise<CourseRow> {
  const result = await pool.query<CourseRow>(
    `
      SELECT c.id, c.name, c.description, c.icon_key, c.icon_url, c.status, c.created_at, c.updated_at,
        COUNT(DISTINCT m.id)::TEXT AS module_count, COUNT(DISTINCT l.id)::TEXT AS lesson_count
      FROM curriculum_courses c
      LEFT JOIN curriculum_modules m ON m.course_id = c.id
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      WHERE c.id = $1 GROUP BY c.id
    `,
    [id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Course not found", "COURSE_NOT_FOUND");
  return result.rows[0];
}

async function getModuleRow(id: string): Promise<ModuleRow> {
  const result = await pool.query<ModuleRow>(
    `
      SELECT m.id, m.course_id, c.name AS course_name, m.name, m.description, m.sort_order, m.status, m.created_at, m.updated_at,
        COUNT(DISTINCT l.id)::TEXT AS lesson_count,
        COUNT(DISTINCT tma.teacher_id) FILTER (WHERE tma.is_active)::TEXT AS teacher_count
      FROM curriculum_modules m JOIN curriculum_courses c ON c.id = m.course_id
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      LEFT JOIN teacher_module_access tma ON tma.module_id = m.id
      WHERE m.id = $1 GROUP BY m.id, c.name
    `,
    [id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Module not found", "MODULE_NOT_FOUND");
  return result.rows[0];
}

async function assertActiveCourse(id: string): Promise<void> {
  const result = await pool.query<{ status: CurriculumStatus }>("SELECT status FROM curriculum_courses WHERE id = $1", [id]);
  if (!result.rows[0]) throw new ApiError(404, "Course not found", "COURSE_NOT_FOUND");
  if (result.rows[0].status !== "active") throw new ApiError(409, "Inactive courses cannot receive new modules", "COURSE_INACTIVE");
}

async function assertActiveModule(id: string): Promise<void> {
  const result = await pool.query<{ status: CurriculumStatus }>("SELECT status FROM curriculum_modules WHERE id = $1", [id]);
  if (!result.rows[0]) throw new ApiError(404, "Module not found", "MODULE_NOT_FOUND");
  if (result.rows[0].status !== "active") throw new ApiError(409, "Inactive modules cannot receive new curriculum classes", "MODULE_INACTIVE");
}

async function assertActiveLesson(id: string): Promise<void> {
  const result = await pool.query<{ status: CurriculumStatus }>("SELECT status FROM curriculum_lessons WHERE id = $1", [id]);
  if (!result.rows[0]) throw new ApiError(404, "Curriculum class not found", "LESSON_NOT_FOUND");
  if (result.rows[0].status !== "active") throw new ApiError(409, "Inactive curriculum classes cannot receive new materials", "LESSON_INACTIVE");
}

async function getLessonRow(id: string): Promise<LessonRow> {
  const result = await pool.query<LessonRow>(
    `
      SELECT l.id, l.module_id, m.name AS module_name, m.course_id, c.name AS course_name, l.lesson_number, l.title, l.description,
        l.sort_order, l.status, l.created_at, l.updated_at, COUNT(cm.id)::TEXT AS material_count
      FROM curriculum_lessons l JOIN curriculum_modules m ON m.id = l.module_id JOIN curriculum_courses c ON c.id = m.course_id
      LEFT JOIN curriculum_materials cm ON cm.lesson_id = l.id AND cm.status = 'active'
      WHERE l.id = $1 GROUP BY l.id, m.name, m.course_id, c.name
    `,
    [id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Curriculum class not found", "LESSON_NOT_FOUND");
  return result.rows[0];
}

async function assertActiveTeachers(teacherIds: string[]): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `
      SELECT DISTINCT u.id
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = ANY($1::UUID[]) AND u.is_active = TRUE AND u.status = 'active' AND r.name = 'teacher'
    `,
    [teacherIds]
  );
  if (result.rows.length !== teacherIds.length) {
    throw new ApiError(422, "Teacher access can only be assigned to active teacher users", "INVALID_TEACHERS");
  }
}

async function assertActiveModules(moduleIds: string[]): Promise<void> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM curriculum_modules WHERE id = ANY($1::UUID[]) AND status = 'active'",
    [moduleIds]
  );
  if (result.rows.length !== moduleIds.length) {
    throw new ApiError(422, "Only active modules can be assigned to a teacher", "INVALID_MODULES");
  }
}

async function notifyModuleAccessChanges(
  client: PoolClient,
  moduleId: string,
  addedTeacherIds: string[],
  removedTeacherIds: string[]
): Promise<void> {
  const moduleResult = await client.query<{ name: string }>("SELECT name FROM curriculum_modules WHERE id = $1", [moduleId]);
  const moduleName = moduleResult.rows[0]?.name;
  if (!moduleName) return;

  if (addedTeacherIds.length) {
    await createInAppNotifications(
      {
        eventKey: "learning_materials.module_access_granted",
        recipientUserIds: addedTeacherIds,
        title: "Module access granted",
        message: `You have been assigned access to: ${moduleName}.`,
        linkPath: "/teacher/dashboard",
        payload: { moduleId }
      },
      client
    );
  }

  if (removedTeacherIds.length) {
    await createInAppNotifications(
      {
        eventKey: "learning_materials.module_access_removed",
        recipientUserIds: removedTeacherIds,
        title: "Module access removed",
        message: `Your access to ${moduleName} has been removed.`,
        linkPath: "/teacher/dashboard",
        payload: { moduleId }
      },
      client
    );
  }
}

async function notifyTeacherAccessChanges(
  client: PoolClient,
  teacherId: string,
  addedModuleIds: string[],
  removedModuleIds: string[]
): Promise<void> {
  const moduleNames = await getModuleNames(client, [...new Set([...addedModuleIds, ...removedModuleIds])]);

  for (const moduleId of addedModuleIds) {
    const moduleName = moduleNames.get(moduleId);
    if (!moduleName) continue;
    await createInAppNotifications(
      {
        eventKey: "learning_materials.module_access_granted",
        recipientUserIds: [teacherId],
        title: "Module access granted",
        message: `You have been assigned access to: ${moduleName}.`,
        linkPath: "/teacher/dashboard",
        payload: { moduleId }
      },
      client
    );
  }

  for (const moduleId of removedModuleIds) {
    const moduleName = moduleNames.get(moduleId);
    if (!moduleName) continue;
    await createInAppNotifications(
      {
        eventKey: "learning_materials.module_access_removed",
        recipientUserIds: [teacherId],
        title: "Module access removed",
        message: `Your access to ${moduleName} has been removed.`,
        linkPath: "/teacher/dashboard",
        payload: { moduleId }
      },
      client
    );
  }
}

async function getModuleNames(client: PoolClient, moduleIds: string[]): Promise<Map<string, string>> {
  if (!moduleIds.length) return new Map();
  const result = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM curriculum_modules WHERE id = ANY($1::UUID[])",
    [moduleIds]
  );
  return new Map(result.rows.map((module) => [module.id, module.name]));
}

function mapCourse(row: CourseRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    iconKey: row.icon_key,
    iconUrl: row.icon_url,
    status: row.status,
    moduleCount: Number(row.module_count),
    lessonCount: Number(row.lesson_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapModule(row: ModuleRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    status: row.status,
    lessonCount: Number(row.lesson_count),
    teacherCount: Number(row.teacher_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLesson(row: LessonRow) {
  return { id: row.id, moduleId: row.module_id, moduleName: row.module_name, courseId: row.course_id, courseName: row.course_name, lessonNumber: row.lesson_number, title: row.title, description: row.description, sortOrder: row.sort_order, status: row.status, materialCount: Number(row.material_count), createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapMaterial(row: MaterialRow) {
  return { id: row.id, logicalId: row.logical_id, lessonId: row.lesson_id, section: row.section, sourceType: row.source_type, title: row.title, fileUrl: row.file_url, storageKey: row.storage_key, fileName: row.file_name, mimeType: row.mime_type, sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes), externalUrl: row.external_url, audience: row.audience, allowLateSubmission: row.allow_late_submission, version: row.version, status: row.status, replacesMaterialId: row.replaces_material_id, createdAt: row.created_at, updatedAt: row.updated_at };
}

function addUpdate(assignments: string[], values: unknown[], column: string, value: unknown): void {
  if (value !== undefined) {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }
}

function handleUniqueViolation(error: unknown, message: string, code: string): void {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new ApiError(409, message, code);
  }
}

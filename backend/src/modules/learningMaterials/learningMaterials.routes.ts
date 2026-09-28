import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission, requireRole } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as controller from "./learningMaterials.controller.js";
import {
  createCourseSchema,
  createModuleSchema,
  getCourseSchema,
  getModuleSchema,
  getTeacherModulesSchema,
  listTeacherAccessSchema,
  listCoursesSchema,
  listModulesSchema,
  replaceTeacherModulesSchema,
  replaceModuleTeachersSchema,
  updateCourseSchema,
  updateModuleSchema
} from "./learningMaterials.validation.js";
import { createLessonSchema, createMaterialRevisionSchema, createMaterialSchema, getLessonSchema, getMaterialSchema, listLessonsSchema, updateLessonSchema } from "./learningMaterials.validation.js";
import { uploadLimitBytes } from "./learningMaterials.storage.js";

export const learningMaterialsRoutes = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: uploadLimitBytes() } });

learningMaterialsRoutes.use(authMiddleware);

learningMaterialsRoutes.get("/courses", requireRole("admin"), requirePermission("learning_materials.view"), validate(listCoursesSchema), controller.listCourses);
learningMaterialsRoutes.post("/courses", requireRole("admin"), requirePermission("learning_materials.create"), validate(createCourseSchema), controller.createCourse);
learningMaterialsRoutes.get("/courses/:id", requireRole("admin"), requirePermission("learning_materials.view"), validate(getCourseSchema), controller.getCourse);
learningMaterialsRoutes.patch("/courses/:id", requireRole("admin"), requirePermission("learning_materials.update"), validate(updateCourseSchema), controller.updateCourse);

learningMaterialsRoutes.get("/modules", requirePermission("learning_materials.view"), validate(listModulesSchema), controller.listModules);
learningMaterialsRoutes.post("/modules", requirePermission("learning_materials.create"), validate(createModuleSchema), controller.createModule);
learningMaterialsRoutes.get("/modules/:id", requirePermission("learning_materials.view"), validate(getModuleSchema), controller.getModule);
learningMaterialsRoutes.patch("/modules/:id", requirePermission("learning_materials.update"), validate(updateModuleSchema), controller.updateModule);
learningMaterialsRoutes.put(
  "/modules/:id/teachers",
  requireRole("admin"),
  requirePermission("learning_materials.manage_access"),
  validate(replaceModuleTeachersSchema),
  controller.replaceModuleTeachers
);
learningMaterialsRoutes.get(
  "/teacher-access",
  requireRole("admin"),
  requirePermission("learning_materials.manage_access"),
  validate(listTeacherAccessSchema),
  controller.listTeacherAccess
);
learningMaterialsRoutes.get(
  "/teachers/:teacherId/modules",
  requireRole("admin"),
  requirePermission("learning_materials.manage_access"),
  validate(getTeacherModulesSchema),
  controller.getTeacherModules
);
learningMaterialsRoutes.put(
  "/teachers/:teacherId/modules",
  requireRole("admin"),
  requirePermission("learning_materials.manage_access"),
  validate(replaceTeacherModulesSchema),
  controller.replaceTeacherModules
);

learningMaterialsRoutes.get("/my/modules", requirePermission("learning_materials.modules.view"), controller.listMyModules);
learningMaterialsRoutes.get("/my/classes", requirePermission("learning_materials.classes.view"), controller.listMyLessons);
learningMaterialsRoutes.get("/my/modules/:id", requirePermission("learning_materials.modules.view"), validate(getModuleSchema), controller.getMyModule);
learningMaterialsRoutes.get("/my/classes/:id", requirePermission("learning_materials.classes.view"), validate(getLessonSchema), controller.getMyLesson);
learningMaterialsRoutes.get("/my/materials/:id/download", requirePermission("learning_materials.classes.view"), validate(getMaterialSchema), controller.downloadMyMaterial);

learningMaterialsRoutes.get("/lessons", requirePermission("learning_materials.view"), validate(listLessonsSchema), controller.listLessons);
learningMaterialsRoutes.post("/lessons", requirePermission("learning_materials.create"), validate(createLessonSchema), controller.createLesson);
learningMaterialsRoutes.get("/lessons/:id", requirePermission("learning_materials.view"), validate(getLessonSchema), controller.getLesson);
learningMaterialsRoutes.patch("/lessons/:id", requirePermission("learning_materials.update"), validate(updateLessonSchema), controller.updateLesson);
learningMaterialsRoutes.post("/uploads", requirePermission("learning_materials.create"), upload.single("file"), controller.uploadMaterialFile);
learningMaterialsRoutes.post("/materials", requirePermission("learning_materials.create"), validate(createMaterialSchema), controller.createMaterial);
learningMaterialsRoutes.post("/materials/:id/revisions", requirePermission("learning_materials.update"), validate(createMaterialRevisionSchema), controller.createMaterialRevision);
learningMaterialsRoutes.get("/materials/:id/download", requirePermission("learning_materials.view"), validate(getMaterialSchema), controller.downloadMaterial);
learningMaterialsRoutes.delete("/materials/:id", requirePermission("learning_materials.update"), validate(getMaterialSchema), controller.deleteMaterial);

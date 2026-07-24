import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type {
  DepartmentContentPayload,
  DepartmentDocument,
  DepartmentProject,
  DepartmentPublic,
  DepartmentUploadPublic,
  UserPublic,
} from "../api/types";
import { RichTextContent, RichTextEditor } from "./UserProfilePage";

type DepartmentTab = "general" | "documents" | "projects";

type ShellContext = {
  me: UserPublic | null;
};

type DepartmentDraft = {
  description: string;
  documents: DepartmentDocument[];
  projects: DepartmentProject[];
};

const departmentTabs: { id: DepartmentTab; label: string }[] = [
  { id: "general", label: "Общая информация об отделе" },
  { id: "documents", label: "Внутренние документы" },
  { id: "projects", label: "Задачи и проекты" },
];

const emptyDocument: DepartmentDocument = { title: "", description: "", url: "" };
const emptyProject: DepartmentProject = { title: "", description: "", owner: "", status: "", dueDate: "" };

function getInitials(user: { first_name: string; last_name: string }) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

function fullName(user: { first_name: string; last_name: string }) {
  return `${user.first_name} ${user.last_name}`.trim();
}

function toDraft(department: DepartmentPublic): DepartmentDraft {
  return {
    description: department.description ?? "",
    documents: department.documents?.length ? department.documents : [],
    projects: department.projects?.length ? department.projects : [],
  };
}

export function DepartmentDetailsPage() {
  const { me } = useOutletContext<ShellContext>();
  const { id } = useParams();
  const departmentId = Number(id);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [employees, setEmployees] = useState<UserPublic[]>([]);
  const [activeTab, setActiveTab] = useState<DepartmentTab>("general");
  const [draft, setDraft] = useState<DepartmentDraft>({ description: "", documents: [], projects: [] });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!Number.isFinite(departmentId)) {
      setError("Отдел не найден.");
      setLoading(false);
      return;
    }

    Promise.all([
      apiFetch<DepartmentPublic[]>("/departments"),
      apiFetch<UserPublic[]>(`/users?department_id=${departmentId}`),
    ])
      .then(([departmentData, employeeData]) => {
        if (cancelled) return;
        setDepartments(departmentData);
        setEmployees(employeeData);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        if (fetchError instanceof ApiError && fetchError.status === 401) {
          setError("Нужно войти, чтобы видеть отдел.");
        } else {
          setError(fetchError instanceof Error ? fetchError.message : "Не удалось загрузить отдел.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  const department = useMemo(
    () => departments.find((item) => item.id === departmentId) ?? null,
    [departmentId, departments],
  );
  const parentDepartment = department?.parent_id
    ? departments.find((item) => item.id === department.parent_id) ?? null
    : null;
  const childDepartments = department ? departments.filter((item) => item.parent_id === department.id) : [];
  const manager = department?.manager ?? null;
  const canEditDepartment = Boolean(department && (me?.role === "admin" || me?.id === department.manager_id));

  useEffect(() => {
    if (!department || isEditing) return;
    setDraft(toDraft(department));
  }, [department, isEditing]);

  async function saveActiveTab() {
    if (!department) return;
    const payload: DepartmentContentPayload =
      activeTab === "general"
        ? { description: draft.description }
        : activeTab === "documents"
          ? { documents: draft.documents }
          : { projects: draft.projects };

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const updated = await apiFetch<DepartmentPublic>(`/departments/${department.id}/content`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setDepartments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDraft(toDraft(updated));
      setIsEditing(false);
      setSaveMessage("Изменения сохранены.");
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="card pageHero">
        <div className="cardInner muted">Загрузка отдела...</div>
      </section>
    );
  }

  if (error || !department) {
    return (
      <section className="card pageHero">
        <div className="cardInner">
          <h1 style={{ marginTop: 0 }}>Отдел</h1>
          <div className="muted">{error || "Отдел не найден."}</div>
          <div style={{ marginTop: 14 }}>
            <Link className="btn" to="/departments">
              ← К списку отделов
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card pageHero departmentDetails">
      <div className="cardInner">
        <div className="row departmentDetailsHeader">
          <div>
            <div className="newsBadge">Отдел</div>
            <h1 style={{ margin: "10px 0 6px" }}>{department.name}</h1>
            <div className="muted">
              {parentDepartment ? `Входит в: ${parentDepartment.name}` : "Самостоятельный отдел"}
            </div>
          </div>
          <div className="spacer" />
          {canEditDepartment && !isEditing && (
            <button
              className="btn btnPrimary"
              type="button"
              onClick={() => {
                setDraft(toDraft(department));
                setSaveError(null);
                setSaveMessage(null);
                setIsEditing(true);
              }}
            >
              Редактировать
            </button>
          )}
          <Link className="btn" to="/departments">
            ← К списку
          </Link>
        </div>

        <div className="profileTabs" role="tablist" aria-label="Разделы отдела">
          {departmentTabs.map((tab) => (
            <button
              key={tab.id}
              className={`profileTab ${activeTab === tab.id ? "profileTabActive" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSaveError(null);
                setSaveMessage(null);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isEditing && (
          <div className="departmentEditBar">
            <div className="muted">Редактируется вкладка: {departmentTabs.find((tab) => tab.id === activeTab)?.label}</div>
            <div className="spacer" />
            <button
              className="btn"
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(toDraft(department));
                setIsEditing(false);
                setSaveError(null);
              }}
            >
              Отменить
            </button>
            <button className="btn btnPrimary" type="button" disabled={saving} onClick={saveActiveTab}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        )}

        {saveError && <div className="departmentAlert departmentAlertError">{saveError}</div>}
        {saveMessage && <div className="departmentAlert departmentAlertSuccess">{saveMessage}</div>}

        {activeTab === "general" && (
          <DepartmentGeneralTab
            department={department}
            manager={manager}
            employees={employees}
            childDepartments={childDepartments}
            draft={draft}
            isEditing={isEditing}
            setDraft={setDraft}
          />
        )}
        {activeTab === "documents" && (
          <DepartmentDocumentsTab
            departmentId={department.id}
            draft={draft}
            isEditing={isEditing}
            setDraft={setDraft}
          />
        )}
        {activeTab === "projects" && (
          <DepartmentProjectsTab draft={draft} isEditing={isEditing} setDraft={setDraft} />
        )}
      </div>
    </section>
  );
}

function DepartmentGeneralTab({
  department,
  manager,
  employees,
  childDepartments,
  draft,
  isEditing,
  setDraft,
}: {
  department: DepartmentPublic;
  manager: DepartmentPublic["manager"];
  employees: UserPublic[];
  childDepartments: DepartmentPublic[];
  draft: DepartmentDraft;
  isEditing: boolean;
  setDraft: Dispatch<SetStateAction<DepartmentDraft>>;
}) {
  return (
    <div className="departmentTabPanel" role="tabpanel">
      <div className="departmentOverviewGrid">
        <div className="departmentInfoCard">
          <span>Руководитель</span>
          {manager ? (
            <Link className="departmentManager" to={`/users/${manager.id}`}>
              <div className="avatar avatarRound departmentAvatar">
                {manager.avatar_url ? (
                  <img src={manager.avatar_url} alt={fullName(manager)} className="avatarImage" />
                ) : (
                  getInitials(manager)
                )}
              </div>
              <div>
                <strong>{fullName(manager)}</strong>
                <small>{manager.title || "Руководитель отдела"}</small>
              </div>
            </Link>
          ) : (
            <strong>Руководитель не назначен</strong>
          )}
        </div>

        <div className="departmentInfoCard">
          <span>Сотрудники</span>
          <strong>{employees.length}</strong>
          <small>Активных сотрудников в отделе</small>
        </div>

        <div className="departmentInfoCard">
          <span>Подразделения</span>
          <strong>{childDepartments.length}</strong>
          <small>{childDepartments.length ? "Есть вложенные отделы" : "Вложенных отделов нет"}</small>
        </div>
      </div>

      <div className="departmentSection">
        <h2>Об отделе</h2>
        {isEditing ? (
          <RichTextEditor
            value={draft.description}
            placeholder="Опишите задачи отдела, зоны ответственности, ключевые контакты или внутренние правила."
            maxLength={3000}
            onChange={(description) => setDraft((current) => ({ ...current, description }))}
          />
        ) : (
          <RichTextContent
            value={department.description}
            emptyText="Описание отдела пока не заполнено."
          />
        )}
      </div>

      {childDepartments.length > 0 && (
        <div className="departmentSection">
          <h2>Подразделения</h2>
          <div className="departmentChipList">
            {childDepartments.map((child) => (
              <Link className="departmentChip" to={`/departments/${child.id}`} key={child.id}>
                {child.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="departmentSection">
        <div className="row">
          <h2>Сотрудники отдела</h2>
          <div className="spacer" />
          <span className="muted">{department.employee_count} в базе</span>
        </div>

        {employees.length === 0 ? (
          <div className="departmentEmpty">В этом отделе пока нет сотрудников.</div>
        ) : (
          <div className="departmentEmployeeGrid">
            {employees.map((employee) => (
              <Link className="departmentEmployeeCard" to={`/users/${employee.id}`} key={employee.id}>
                <div className="avatar avatarRound departmentAvatar">
                  {employee.avatar_url ? (
                    <img src={employee.avatar_url} alt={fullName(employee)} className="avatarImage" />
                  ) : (
                    getInitials(employee)
                  )}
                </div>
                <div>
                  <strong>{fullName(employee)}</strong>
                  <span>{employee.title || "Должность не указана"}</span>
                  <small>{employee.email}</small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DepartmentDocumentsTab({
  departmentId,
  draft,
  isEditing,
  setDraft,
}: {
  departmentId: number;
  draft: DepartmentDraft;
  isEditing: boolean;
  setDraft: Dispatch<SetStateAction<DepartmentDraft>>;
}) {
  return (
    <div className="departmentTabPanel" role="tabpanel">
      <div className="departmentSection">
        <div className="row">
          <h2>Внутренние документы</h2>
          <div className="spacer" />
          {isEditing && (
            <button
              className="btn"
              type="button"
              onClick={() =>
                setDraft((current) => ({ ...current, documents: [...current.documents, { ...emptyDocument }] }))
              }
            >
              Добавить документ
            </button>
          )}
        </div>

        {isEditing ? (
          <DocumentEditor departmentId={departmentId} documents={draft.documents} setDraft={setDraft} />
        ) : draft.documents.length ? (
          <div className="departmentDocumentGrid">
            {draft.documents.map((document, index) => (
              <div className="departmentRecordCard" key={`${document.title}-${index}`}>
                <strong>{document.title || "Документ без названия"}</strong>
                {document.description && <RichTextContent value={document.description} />}
                {document.url && (
                  <a className="btn" href={document.url} target="_blank" rel="noreferrer">
                    Открыть
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="departmentEmpty">
            Документы отдела пока не добавлены. Здесь будут регламенты, инструкции, шаблоны и полезные файлы отдела.
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentEditor({
  departmentId,
  documents,
  setDraft,
}: {
  departmentId: number;
  documents: DepartmentDocument[];
  setDraft: Dispatch<SetStateAction<DepartmentDraft>>;
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  async function uploadDocumentFile(index: number, file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploadingIndex(index);
    try {
      const uploaded = await apiFetch<DepartmentUploadPublic>(`/departments/${departmentId}/documents/upload`, {
        method: "POST",
        body: form,
      });
      setDraft((current) => ({
        ...current,
        documents: current.documents.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                title: item.title || uploaded.name,
                url: uploaded.url,
              }
            : item,
        ),
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Не удалось загрузить файл");
    } finally {
      setUploadingIndex(null);
    }
  }

  if (documents.length === 0) {
    return <div className="departmentEmpty">Нажмите “Добавить документ”, чтобы создать первую запись.</div>;
  }

  return (
    <div className="departmentEditList">
      {documents.map((document, index) => (
        <div className="departmentEditItem" key={index}>
          <input
            className="input"
            value={document.title}
            placeholder="Название документа"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                documents: current.documents.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, title: event.target.value } : item,
                ),
              }))
            }
          />
          <input
            className="input"
            value={document.url}
            placeholder="Ссылка на документ или файл"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                documents: current.documents.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, url: event.target.value } : item,
                ),
              }))
            }
          />
          <div className="departmentUploadRow">
            <input
              className="departmentFileInput"
              id={`department-document-upload-${index}`}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*"
              onChange={(event) => {
                void uploadDocumentFile(index, event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <label className="btn" htmlFor={`department-document-upload-${index}`}>
              {uploadingIndex === index ? "Загрузка..." : "Прикрепить файл"}
            </label>
            {document.url && (
              <a className="btn" href={document.url} target="_blank" rel="noreferrer">
                Открыть файл
              </a>
            )}
          </div>
          <RichTextEditor
            value={document.description}
            placeholder="Краткое описание"
            maxLength={3000}
            onChange={(description) =>
              setDraft((current) => ({
                ...current,
                documents: current.documents.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, description } : item,
                ),
              }))
            }
          />
          <button
            className="btn"
            type="button"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                documents: current.documents.filter((_, itemIndex) => itemIndex !== index),
              }))
            }
          >
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
}

function DepartmentProjectsTab({
  draft,
  isEditing,
  setDraft,
}: {
  draft: DepartmentDraft;
  isEditing: boolean;
  setDraft: Dispatch<SetStateAction<DepartmentDraft>>;
}) {
  return (
    <div className="departmentTabPanel" role="tabpanel">
      <div className="departmentSection">
        <div className="row">
          <h2>Задачи и проекты</h2>
          <div className="spacer" />
          {isEditing && (
            <button
              className="btn"
              type="button"
              onClick={() =>
                setDraft((current) => ({ ...current, projects: [...current.projects, { ...emptyProject }] }))
              }
            >
              Добавить проект
            </button>
          )}
        </div>

        {isEditing ? (
          <ProjectEditor projects={draft.projects} setDraft={setDraft} />
        ) : draft.projects.length ? (
          <div className="departmentProjectGrid">
            {draft.projects.map((project, index) => (
              <div className="departmentRecordCard" key={`${project.title}-${index}`}>
                <div className="row">
                  <strong>{project.title || "Проект без названия"}</strong>
                  {project.status && <span className="newsBadge">{project.status}</span>}
                </div>
                {project.description && <RichTextContent value={project.description} />}
                <small>
                  {project.owner && `Ответственный: ${project.owner}`}
                  {project.owner && project.dueDate ? " · " : ""}
                  {project.dueDate && `Срок: ${project.dueDate}`}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className="departmentProjectGrid">
            <div className="departmentEmpty">
              Активные задачи пока не добавлены. Позже сюда можно подключить проекты отдела, ответственных и сроки.
            </div>
            <div className="departmentEmpty">
              Завершенные проекты пока не добавлены. Этот блок подойдет для истории инициатив отдела.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectEditor({
  projects,
  setDraft,
}: {
  projects: DepartmentProject[];
  setDraft: Dispatch<SetStateAction<DepartmentDraft>>;
}) {
  if (projects.length === 0) {
    return <div className="departmentEmpty">Нажмите “Добавить проект”, чтобы создать первую запись.</div>;
  }

  function updateProject(index: number, patch: Partial<DepartmentProject>) {
    setDraft((current) => ({
      ...current,
      projects: current.projects.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  return (
    <div className="departmentEditList">
      {projects.map((project, index) => (
        <div className="departmentEditItem" key={index}>
          <div className="departmentEditGrid">
            <input
              className="input"
              value={project.title}
              placeholder="Название проекта или задачи"
              onChange={(event) => updateProject(index, { title: event.target.value })}
            />
            <input
              className="input"
              value={project.status}
              placeholder="Статус"
              onChange={(event) => updateProject(index, { status: event.target.value })}
            />
            <input
              className="input"
              value={project.owner}
              placeholder="Ответственный"
              onChange={(event) => updateProject(index, { owner: event.target.value })}
            />
            <input
              className="input"
              value={project.dueDate}
              placeholder="Срок"
              onChange={(event) => updateProject(index, { dueDate: event.target.value })}
            />
          </div>
          <RichTextEditor
            value={project.description}
            placeholder="Описание"
            maxLength={3000}
            onChange={(description) => updateProject(index, { description })}
          />
          <button
            className="btn"
            type="button"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                projects: current.projects.filter((_, itemIndex) => itemIndex !== index),
              }))
            }
          >
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
}

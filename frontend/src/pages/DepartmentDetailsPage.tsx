import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { DepartmentPublic, UserPublic } from "../api/types";

type DepartmentTab = "general" | "documents" | "projects";

const departmentTabs: { id: DepartmentTab; label: string }[] = [
  { id: "general", label: "Общая информация об отделе" },
  { id: "documents", label: "Внутренние документы" },
  { id: "projects", label: "Задачи и проекты" },
];

function getInitials(user: { first_name: string; last_name: string }) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

function fullName(user: { first_name: string; last_name: string }) {
  return `${user.first_name} ${user.last_name}`.trim();
}

export function DepartmentDetailsPage() {
  const { id } = useParams();
  const departmentId = Number(id);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [employees, setEmployees] = useState<UserPublic[]>([]);
  const [activeTab, setActiveTab] = useState<DepartmentTab>("general");
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
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "general" && (
          <DepartmentGeneralTab
            department={department}
            manager={manager}
            employees={employees}
            childDepartments={childDepartments}
          />
        )}
        {activeTab === "documents" && <DepartmentDocumentsTab />}
        {activeTab === "projects" && <DepartmentProjectsTab />}
      </div>
    </section>
  );
}

function DepartmentGeneralTab({
  department,
  manager,
  employees,
  childDepartments,
}: {
  department: DepartmentPublic;
  manager: DepartmentPublic["manager"];
  employees: UserPublic[];
  childDepartments: DepartmentPublic[];
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

function DepartmentDocumentsTab() {
  return (
    <div className="departmentTabPanel" role="tabpanel">
      <div className="departmentSection">
        <h2>Внутренние документы</h2>
        <div className="departmentEmpty">
          Документы отдела пока не добавлены. Здесь будут регламенты, инструкции, шаблоны и полезные файлы отдела.
        </div>
      </div>
    </div>
  );
}

function DepartmentProjectsTab() {
  return (
    <div className="departmentTabPanel" role="tabpanel">
      <div className="departmentSection">
        <h2>Задачи и проекты</h2>
        <div className="departmentProjectGrid">
          <div className="departmentEmpty">
            Активные задачи пока не добавлены. Позже сюда можно подключить проекты отдела, ответственных и сроки.
          </div>
          <div className="departmentEmpty">
            Завершенные проекты пока не добавлены. Этот блок подойдет для истории инициатив отдела.
          </div>
        </div>
      </div>
    </div>
  );
}

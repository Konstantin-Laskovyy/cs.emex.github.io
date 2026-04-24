import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { DepartmentPublic, UserPublic } from "../api/types";
import { flattenOrg, orgStructure, type OrgNode } from "../data/orgStructure";

function OrgTreeNode({
  node,
  level = 0,
  selectedId,
  onSelect,
}: {
  node: OrgNode;
  level?: number;
  selectedId: string;
  onSelect: (node: OrgNode) => void;
}) {
  const hasChildren = Boolean(node.children?.length);

  return (
    <div className="orgTreeItem" style={{ ["--org-level" as string]: level }}>
      <button
        className={`orgNode ${selectedId === node.id ? "orgNodeActive" : ""}`}
        type="button"
        onClick={() => onSelect(node)}
      >
        <span className="orgNodeTitle">{node.title}</span>
        {node.managerName && <span className="orgNodeManager">{node.managerName}</span>}
        {hasChildren && <span className="orgNodeCount">{node.children?.length} подразделений</span>}
      </button>

      {hasChildren && (
        <div className="orgTreeChildren">
          {node.children?.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function initials(user: UserPublic) {
  return `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "EM";
}

export function OrgStructurePage() {
  const allNodes = useMemo(() => flattenOrg(orgStructure), []);
  const [selectedNode, setSelectedNode] = useState<OrgNode>(orgStructure);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [employees, setEmployees] = useState<UserPublic[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departmentByName = useMemo(() => {
    const map = new Map<string, DepartmentPublic>();
    departments.forEach((department) => map.set(department.name.toLowerCase(), department));
    return map;
  }, [departments]);

  const linkedDepartment = selectedNode.departmentName
    ? departmentByName.get(selectedNode.departmentName.toLowerCase())
    : undefined;

  useEffect(() => {
    let cancelled = false;
    apiFetch<DepartmentPublic[]>("/departments")
      .then((data) => {
        if (!cancelled) setDepartments(data);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setEmployees([]);
    setError(null);

    if (!linkedDepartment) return;

    setLoadingEmployees(true);
    apiFetch<UserPublic[]>(`/users?department_id=${linkedDepartment.id}`)
      .then((data) => {
        if (!cancelled) setEmployees(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setError("Нужно войти, чтобы видеть сотрудников отдела.");
        } else {
          setError(err instanceof Error ? err.message : "Не удалось загрузить сотрудников отдела.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployees(false);
      });

    return () => {
      cancelled = true;
    };
  }, [linkedDepartment?.id]);

  return (
    <div className="orgPage">
      <section className="card orgIntro">
        <div className="cardInner">
          <div className="newsBadge">Оргструктура</div>
          <h1 style={{ margin: "10px 0 8px" }}>Организационная структура компании</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
            Дерево показывает подчиненность подразделений. Выберите отдел слева, чтобы увидеть руководителя,
            должности из оргструктуры и сотрудников, которые уже заведены в системе.
          </p>
        </div>
      </section>

      <div className="orgLayout">
        <section className="card orgTreeCard">
          <div className="cardInner">
            <div className="sectionTitle">Дерево компании</div>
            <div className="orgTree">
              <OrgTreeNode node={orgStructure} selectedId={selectedNode.id} onSelect={setSelectedNode} />
            </div>
          </div>
        </section>

        <aside className="card orgDetailsCard">
          <div className="cardInner">
            <div className="sectionTitle">Карточка подразделения</div>
            <h2 style={{ margin: "4px 0 6px" }}>{selectedNode.title}</h2>

            <div className="orgMetaGrid">
              <div className="orgMetaBox">
                <span>Руководитель</span>
                <strong>{selectedNode.managerName || "Не указан"}</strong>
                {selectedNode.managerTitle && <small>{selectedNode.managerTitle}</small>}
              </div>
              <div className="orgMetaBox">
                <span>Подразделений ниже</span>
                <strong>{selectedNode.children?.length ?? 0}</strong>
                <small>В текущей ветке структуры</small>
              </div>
            </div>

            <div className="orgPanelSection">
              <h3>Должности из оргструктуры</h3>
              {selectedNode.positions?.length ? (
                <div className="orgPositionList">
                  {selectedNode.positions.map((position) => (
                    <span key={position}>{position}</span>
                  ))}
                </div>
              ) : (
                <p className="muted">Для этого узла должности пока не указаны.</p>
              )}
            </div>

            <div className="orgPanelSection">
              <h3>Сотрудники отдела</h3>
              {!selectedNode.departmentName && (
                <p className="muted">Это сводный блок. Выберите конкретный отдел ниже по дереву.</p>
              )}
              {selectedNode.departmentName && !linkedDepartment && (
                <p className="muted">
                  Отдел «{selectedNode.departmentName}» есть в оргструктуре, но пока не найден в базе сотрудников.
                </p>
              )}
              {loadingEmployees && <p className="muted">Загружаем сотрудников...</p>}
              {error && <div className="errorBox">{error}</div>}
              {!loadingEmployees && linkedDepartment && employees.length === 0 && (
                <p className="muted">В этом отделе пока нет сотрудников в системе.</p>
              )}
              <div className="orgEmployeeList">
                {employees.map((employee) => (
                  <Link className="orgEmployee" key={employee.id} to={`/users/${employee.id}`}>
                    <span className="avatar orgEmployeeAvatar">
                      {employee.avatar_url ? (
                        <img className="avatarImage" src={employee.avatar_url} alt={`${employee.first_name} ${employee.last_name}`} />
                      ) : (
                        initials(employee)
                      )}
                    </span>
                    <span>
                      <strong>{employee.first_name} {employee.last_name}</strong>
                      <small>{employee.title || "Должность не указана"}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="orgPanelSection">
              <h3>Быстрый переход</h3>
              <div className="orgQuickList">
                {allNodes
                  .filter((node) => node.id !== selectedNode.id)
                  .slice(0, 6)
                  .map((node) => (
                    <button className="orgQuickButton" key={node.id} type="button" onClick={() => setSelectedNode(node)}>
                      {node.title}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

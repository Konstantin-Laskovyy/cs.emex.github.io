import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { DepartmentPublic, OrgRootPublic, UserPublic } from "../api/types";
import { flattenOrg, orgStructure, type OrgNode } from "../data/orgStructure";

function buildDepartmentOrg(departments: DepartmentPublic[], root?: OrgRootPublic | null): OrgNode {
  const byParent = new Map<number | null, DepartmentPublic[]>();
  departments.forEach((department) => {
    const key = department.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), department]);
  });

  const buildNode = (department: DepartmentPublic): OrgNode => ({
    id: `department-${department.id}`,
    title: department.name,
    departmentName: department.name,
    sourceDepartmentId: department.id,
    managerName: department.manager
      ? `${department.manager.first_name} ${department.manager.last_name}`
      : "Руководитель не назначен",
    managerTitle: department.manager?.title ?? undefined,
    positions: ["Сотрудники отдела отображаются из базы"],
    children: (byParent.get(department.id) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(buildNode),
  });

  return {
    id: "company-db",
    title: root?.name || "ТОО «EMEX»",
    managerTitle: "Оргструктура из базы",
    managerName: root?.manager
      ? `${root.manager.first_name} ${root.manager.last_name}`
      : "Управляется в админке",
    positions: ["Отделы, руководители и подчиненность редактируются администратором"],
    children: (byParent.get(null) ?? []).sort((a, b) => a.name.localeCompare(b.name)).map(buildNode),
  };
}

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
  const [selectedNode, setSelectedNode] = useState<OrgNode>(orgStructure);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [orgRoot, setOrgRoot] = useState<OrgRootPublic | null>(null);
  const [employees, setEmployees] = useState<UserPublic[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departmentByName = useMemo(() => {
    const map = new Map<string, DepartmentPublic>();
    departments.forEach((department) => map.set(department.name.toLowerCase(), department));
    return map;
  }, [departments]);

  const managedOrgStructure = useMemo(() => {
    if (departments.length === 0) return orgStructure;
    return buildDepartmentOrg(departments, orgRoot);
  }, [departments, orgRoot]);

  const allNodes = useMemo(() => flattenOrg(managedOrgStructure), [managedOrgStructure]);

  useEffect(() => {
    if (departments.length > 0 && !selectedNode.id.startsWith("department-") && selectedNode.id !== "company-db") {
      setSelectedNode(buildDepartmentOrg(departments, orgRoot));
    }
  }, [departments, orgRoot, selectedNode.id]);

  const linkedDepartment = selectedNode.departmentName
    ? selectedNode.sourceDepartmentId
      ? departments.find((department) => department.id === selectedNode.sourceDepartmentId)
      : departmentByName.get(selectedNode.departmentName.toLowerCase())
    : undefined;

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiFetch<DepartmentPublic[]>("/departments"), apiFetch<OrgRootPublic>("/departments/org-root")])
      .then(([departmentsData, rootData]) => {
        if (cancelled) return;
        setDepartments(departmentsData);
        setOrgRoot(rootData);
      })
      .catch(() => {
        if (!cancelled) {
          setDepartments([]);
          setOrgRoot(null);
        }
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
            Дерево показывает подчиненность подразделений. Выберите отдел слева, чтобы увидеть
            руководителя, должности из оргструктуры и сотрудников, которые уже заведены в системе.
          </p>
        </div>
      </section>

      <div className="orgLayout">
        <section className="card orgTreeCard">
          <div className="cardInner">
            <div className="sectionTitle">Дерево компании</div>
            <div className="orgTree">
              <OrgTreeNode node={managedOrgStructure} selectedId={selectedNode.id} onSelect={setSelectedNode} />
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

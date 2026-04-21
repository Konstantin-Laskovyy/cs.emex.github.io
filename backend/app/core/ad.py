from __future__ import annotations

from dataclasses import dataclass
from secrets import token_urlsafe

from ldap3 import ALL, Connection, NTLM, Server
from ldap3.core.exceptions import LDAPBindError, LDAPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User


@dataclass
class ADIdentity:
    raw_login: str
    sam_account_name: str
    bind_username: str
    search_email: str


@dataclass
class ADProfile:
    email: str
    first_name: str
    last_name: str
    title: str | None = None


def authenticate_ad_user(db: Session, login: str, password: str) -> User | None:
    if not settings.ad_enabled or not settings.ad_server or not settings.ad_base_dn:
        return None

    identity = _normalize_identity(login)
    if not identity or not password:
        return None

    server = Server(settings.ad_server, use_ssl=settings.ad_use_ssl, get_info=ALL)

    try:
        user_conn = _bind_user(server, identity.bind_username, password)
    except LDAPBindError:
        return None
    except LDAPException:
        return None

    try:
        if not user_conn.bound:
            return None

        profile = _resolve_profile(server, user_conn, identity)
        return _upsert_local_user(db, profile)
    finally:
        user_conn.unbind()


def _normalize_identity(login: str) -> ADIdentity | None:
    value = login.strip()
    if not value:
        return None

    if "\\" in value:
        _, username = value.split("\\", 1)
        username = username.strip()
        if not username:
            return None
        bind_username = value
        search_email = f"{username}@{settings.ad_default_email_domain}"
        return ADIdentity(
            raw_login=value,
            sam_account_name=username,
            bind_username=bind_username,
            search_email=search_email,
        )

    if "@" in value:
        username = value.split("@", 1)[0].strip()
        if not username:
            return None
        return ADIdentity(
            raw_login=value,
            sam_account_name=username,
            bind_username=value,
            search_email=value,
        )

    username = value
    bind_username = f"{settings.ad_domain}\\{username}" if settings.ad_domain else username
    search_email = f"{username}@{settings.ad_default_email_domain}"
    return ADIdentity(
        raw_login=value,
        sam_account_name=username,
        bind_username=bind_username,
        search_email=search_email,
    )


def _bind_user(server: Server, bind_username: str, password: str) -> Connection:
    authentication = NTLM if "\\" in bind_username else None
    return Connection(
        server,
        user=bind_username,
        password=password,
        authentication=authentication,
        auto_bind=True,
    )


def _resolve_profile(server: Server, user_conn: Connection, identity: ADIdentity) -> ADProfile:
    conn = _create_search_connection(server) or user_conn
    close_conn = conn is not user_conn

    try:
        search_filter = (
            f"(|(mail={identity.search_email})"
            f"(userPrincipalName={identity.search_email})"
            f"(sAMAccountName={identity.sam_account_name}))"
        )
        conn.search(
            search_base=settings.ad_base_dn,
            search_filter=search_filter,
            attributes=["mail", "givenName", "sn", "displayName", "title", "sAMAccountName"],
            size_limit=1,
        )

        if conn.entries:
            entry = conn.entries[0]
            email = _entry_attr(entry, "mail") or _entry_attr(entry, "userPrincipalName") or identity.search_email
            first_name = _entry_attr(entry, "givenName") or _fallback_first_name(identity.sam_account_name)
            last_name = _entry_attr(entry, "sn") or _fallback_last_name()
            title = _entry_attr(entry, "title")
            return ADProfile(email=email, first_name=first_name, last_name=last_name, title=title)

        return ADProfile(
            email=identity.search_email,
            first_name=_fallback_first_name(identity.sam_account_name),
            last_name=_fallback_last_name(),
            title=None,
        )
    finally:
        if close_conn:
            conn.unbind()


def _create_search_connection(server: Server) -> Connection | None:
    if not settings.ad_bind_dn or not settings.ad_bind_password:
        return None
    return Connection(server, user=settings.ad_bind_dn, password=settings.ad_bind_password, auto_bind=True)


def _entry_attr(entry: object, attr: str) -> str | None:
    try:
        value = getattr(entry, attr).value
    except AttributeError:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _upsert_local_user(db: Session, profile: ADProfile) -> User:
    user = db.query(User).filter(User.email == profile.email).first()
    if user is None:
        user = User(
            email=profile.email,
            password_hash=hash_password(token_urlsafe(24)),
            first_name=profile.first_name,
            last_name=profile.last_name,
            title=profile.title,
            is_active=True,
        )
        db.add(user)
    else:
        user.first_name = profile.first_name
        user.last_name = profile.last_name
        user.title = profile.title
        user.is_active = True

    db.commit()
    db.refresh(user)
    return user


def _fallback_first_name(username: str) -> str:
    cleaned = username.replace(".", " ").replace("_", " ").strip()
    if not cleaned:
        return "User"
    return cleaned.split()[0].capitalize()


def _fallback_last_name() -> str:
    return "AD"

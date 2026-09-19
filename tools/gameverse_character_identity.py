"""Stable Gameverse starter-character identity compatibility model.

The logical starter-character identity is deliberately separated from render
assets and infrastructure versions so scaling cannot silently replace it.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
import re


_ID = re.compile(r"[a-z0-9][a-z0-9._-]{0,63}")


@dataclass(frozen=True)
class StarterCharacterIdentity:
    starter_character_id: str
    nickname_ref: str
    progress_ref: str
    unlocked_routes_ref: str
    identity_revision: int = 1

    def __post_init__(self) -> None:
        if _ID.fullmatch(self.starter_character_id) is None:
            raise ValueError("invalid-starter-character-id")
        if type(self.identity_revision) is not int or self.identity_revision < 1:
            raise ValueError("invalid-identity-revision")


@dataclass(frozen=True)
class CharacterRenderBinding:
    starter_character_id: str
    render_asset_key: str
    render_model_version: str
    compatibility_alias_used: bool = False


def bind_render(
    identity: StarterCharacterIdentity,
    *,
    render_model_version: str,
    available_assets: set[str],
    compatibility_aliases: dict[str, str] | None = None,
) -> CharacterRenderBinding:
    """Select a render asset without changing the stable character identity."""
    aliases = compatibility_aliases or {}
    stable_id = identity.starter_character_id
    if stable_id in available_assets:
        asset = stable_id
        alias_used = False
    else:
        asset = aliases.get(stable_id, "")
        if asset not in available_assets:
            raise ValueError("starter-character-render-unavailable")
        alias_used = True

    return CharacterRenderBinding(
        starter_character_id=stable_id,
        render_asset_key=asset,
        render_model_version=render_model_version,
        compatibility_alias_used=alias_used,
    )


def upgrade_infrastructure(
    identity: StarterCharacterIdentity,
    *,
    network_phase: str,
) -> StarterCharacterIdentity:
    """Infrastructure scaling is identity-neutral by contract."""
    if not network_phase:
        raise ValueError("network-phase-required")
    return identity


def explicit_character_switch(
    identity: StarterCharacterIdentity,
    *,
    new_starter_character_id: str,
    user_confirmed: bool,
) -> StarterCharacterIdentity:
    """Only an explicit user choice can change the stable character identity."""
    if user_confirmed is not True:
        raise ValueError("explicit-user-confirmation-required")
    if _ID.fullmatch(new_starter_character_id) is None:
        raise ValueError("invalid-starter-character-id")
    if new_starter_character_id == identity.starter_character_id:
        return identity
    return replace(
        identity,
        starter_character_id=new_starter_character_id,
        identity_revision=identity.identity_revision + 1,
    )

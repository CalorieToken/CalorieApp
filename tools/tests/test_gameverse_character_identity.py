import unittest

from tools.gameverse_character_identity import (
    StarterCharacterIdentity,
    bind_render,
    explicit_character_switch,
    upgrade_infrastructure,
)


class GameverseCharacterIdentityTests(unittest.TestCase):
    def setUp(self):
        self.identity = StarterCharacterIdentity(
            starter_character_id="starter-original",
            nickname_ref="profile:nickname",
            progress_ref="gameverse:progress",
            unlocked_routes_ref="gameverse:routes",
        )

    def test_render_upgrade_preserves_starter_identity(self):
        binding = bind_render(
            self.identity,
            render_model_version="render-v2",
            available_assets={"starter-original"},
        )
        self.assertEqual(binding.starter_character_id, "starter-original")
        self.assertEqual(binding.render_asset_key, "starter-original")
        self.assertEqual(self.identity.identity_revision, 1)

    def test_compatibility_asset_can_change_without_changing_identity(self):
        binding = bind_render(
            self.identity,
            render_model_version="render-v5",
            available_assets={"starter-original-hd"},
            compatibility_aliases={"starter-original": "starter-original-hd"},
        )
        self.assertEqual(binding.starter_character_id, "starter-original")
        self.assertEqual(binding.render_asset_key, "starter-original-hd")
        self.assertTrue(binding.compatibility_alias_used)

    def test_scaling_network_phase_is_identity_neutral(self):
        for phase in (
            "hosted-core",
            "optional-storage",
            "optional-compute",
            "community-scale",
            "distributed-public-data",
        ):
            upgraded = upgrade_infrastructure(self.identity, network_phase=phase)
            self.assertEqual(upgraded, self.identity)

    def test_scaling_preserves_progress_references(self):
        upgraded = upgrade_infrastructure(self.identity, network_phase="community-scale")
        self.assertEqual(upgraded.nickname_ref, self.identity.nickname_ref)
        self.assertEqual(upgraded.progress_ref, self.identity.progress_ref)
        self.assertEqual(upgraded.unlocked_routes_ref, self.identity.unlocked_routes_ref)

    def test_character_cannot_be_silently_replaced(self):
        with self.assertRaisesRegex(ValueError, "explicit-user-confirmation-required"):
            explicit_character_switch(
                self.identity,
                new_starter_character_id="starter-new",
                user_confirmed=False,
            )

    def test_explicit_user_switch_changes_only_identity_choice_and_revision(self):
        switched = explicit_character_switch(
            self.identity,
            new_starter_character_id="starter-new",
            user_confirmed=True,
        )
        self.assertEqual(switched.starter_character_id, "starter-new")
        self.assertEqual(switched.identity_revision, 2)
        self.assertEqual(switched.nickname_ref, self.identity.nickname_ref)
        self.assertEqual(switched.progress_ref, self.identity.progress_ref)
        self.assertEqual(switched.unlocked_routes_ref, self.identity.unlocked_routes_ref)

    def test_retired_render_asset_requires_compatibility_path(self):
        with self.assertRaisesRegex(ValueError, "starter-character-render-unavailable"):
            bind_render(
                self.identity,
                render_model_version="render-v9",
                available_assets={"different-character"},
            )


if __name__ == "__main__":
    unittest.main()

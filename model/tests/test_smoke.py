from model.version import MODEL_VERSION


def test_model_version_is_semver_string():
    parts = MODEL_VERSION.split(".")
    assert len(parts) == 3
    assert all(p.isdigit() for p in parts)

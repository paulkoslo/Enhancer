from enhancer_sdk import ArtifactWriter, ModelClient, ResearchClient, RunLogger, SandboxContext
from enhancer_sdk import ValidationClient, WorkbookClient


def test_context_exports_components(tmp_path):
    context = SandboxContext(
        workbook=WorkbookClient(input_path=tmp_path / "data.csv"),
        research=ResearchClient(search_handler=lambda payload: payload),
        models=ModelClient(generate_handler=lambda payload: payload),
        validation=ValidationClient(validation_handler=lambda payload: payload),
        logging=RunLogger(emit_handler=lambda level, message: None),
        artifacts=ArtifactWriter(save_handler=lambda kind, payload: None),
    )

    assert context.research.search_web({"query": "acme"}) == {"query": "acme"}

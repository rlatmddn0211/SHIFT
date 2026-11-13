"""Fill the official contest project's fields from docs/SUBMISSION_DRAFT.md.

Requires lxml. Participant details, consent and signatures stay blank.
Usage: python tools/build_submission_docx.py PATH_TO_OFFICIAL_TEMPLATE.docx
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from pathlib import Path
import re
from zipfile import ZipFile

from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W}

# These tag names in the official template do not all match their visible labels.
# Map them to the visible numbered application sections, not their English names.
SECTION_BY_TAG = {
    "app_summary": 1,
    "planning_background": 2,
    "vehicle_scenario": 3,
    "key_features": 4,
    "pleos_plan": 5,
    "reference_files": 6,
    "reference_link": 7,
}


def plain_lines(section: str) -> list[tuple[str, bool]]:
    lines = []
    for original in section.strip().splitlines():
        line = original.strip()
        heading = line.startswith("### ")
        if heading:
            line = line[4:]
        if re.fullmatch(r"\|[\s|:-]+\|", line):
            continue
        if line.startswith("|") and line.endswith("|"):
            line = " / ".join(cell.strip() for cell in line.strip("|").split("|"))
        line = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", line)
        line = line.replace("**", "").replace("`", "")
        lines.append((line, heading))
    return lines


def build(template: Path, output: Path) -> None:
    if template == output:
        raise ValueError("Keep the original template and output at different paths.")
    source = (ROOT / "docs" / "SUBMISSION_DRAFT.md").read_text(encoding="utf-8")
    sections = {
        int(number): body
        for number, body in re.findall(
            r"^## (\d+) [^\n]+\n(.*?)(?=^## |\Z)", source, flags=re.M | re.S
        )
    }
    if not set(SECTION_BY_TAG.values()).issubset(sections):
        raise ValueError("The source must contain numbered sections 1 through 7.")

    with ZipFile(template) as original:
        root = etree.fromstring(original.read("word/document.xml"))
        controls = {}
        for control in root.findall(".//w:sdt", NS):
            tag = control.find("w:sdtPr/w:tag", NS)
            if tag is not None:
                controls[tag.get(f"{{{W}}}val")] = control
        if not set(SECTION_BY_TAG).issubset(controls):
            raise ValueError("The official template's expected fields were not found.")

        for tag, number in SECTION_BY_TAG.items():
            control = controls[tag]
            content = control.find("w:sdtContent", NS)
            if content is None:
                raise ValueError(f"Missing content area: {tag}")
            # Official fields are inline plain-text controls. Use runs and line
            # breaks, preserving the surrounding paragraphs, tables and styles.
            old_run = content.find("w:r", NS)
            run_properties = None if old_run is None else old_run.find("w:rPr", NS)
            for child in list(content):
                content.remove(child)
            for index, (line, heading) in enumerate(plain_lines(sections[number])):
                run = etree.SubElement(content, f"{{{W}}}r")
                props = (
                    deepcopy(run_properties)
                    if run_properties is not None
                    else etree.Element(f"{{{W}}}rPr")
                )
                if heading:
                    etree.SubElement(props, f"{{{W}}}b")
                if len(props):
                    run.append(props)
                if index:
                    etree.SubElement(run, f"{{{W}}}br")
                text = etree.SubElement(run, f"{{{W}}}t")
                text.set(f"{{{XML}}}space", "preserve")
                text.text = line
            properties = control.find("w:sdtPr", NS)
            if properties is not None:
                for placeholder in properties.findall("w:showingPlcHdr", NS):
                    properties.remove(placeholder)
                text_type = properties.find("w:text", NS)
                if text_type is not None:
                    text_type.set(f"{{{W}}}multiLine", "1")
            # Let long project answers continue on the following page. Keep the
            # original registration and consent tables untouched.
            row = next(
                (parent for parent in control.iterancestors() if parent.tag == f"{{{W}}}tr"),
                None,
            )
            if row is not None:
                row_properties = row.find("w:trPr", NS)
                if row_properties is not None:
                    for setting in row_properties.findall("w:cantSplit", NS):
                        row_properties.remove(setting)

        # Fill only the app name; never invent team names, personal data, dates
        # or signatures in the registration/consent sections.
        for paragraph in root.findall(".//w:p", NS):
            values = paragraph.findall(".//w:t", NS)
            if "".join(value.text or "" for value in values).startswith("앱명 / 프로젝트명:"):
                for value in values:
                    if value.text and "_" in value.text:
                        value.text = re.sub(r"_+", "SHIFT", value.text)
                        break

        document = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        with ZipFile(output, "w") as target:
            for entry in original.infolist():
                target.writestr(
                    entry,
                    document if entry.filename == "word/document.xml" else original.read(entry),
                )

    with ZipFile(output) as result:
        if result.testzip() is not None:
            raise ValueError("Generated DOCX failed its archive integrity check.")
        etree.fromstring(result.read("word/document.xml"))
    print(f"Created {output}")
    print("Project sections 1–7 filled. Participant fields and consent/signatures require completion.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "docs" / "SHIFT_application_draft.docx")
    arguments = parser.parse_args()
    build(arguments.template.resolve(), arguments.output.resolve())

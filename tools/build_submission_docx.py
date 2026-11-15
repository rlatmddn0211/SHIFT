"""Fill the official application from docs/SUBMISSION_DRAFT.md.

Requires lxml. Personal details, team name, consent, signatures and dates stay blank.
Only the agreed participant category (university team of two) is prefilled.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
import re
from zipfile import ZipFile

from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
XML = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W, "r": R}
SECTION_BY_TAG = {
    "app_summary": 1,
    "planning_background": 2,
    "vehicle_scenario": 3,
    "key_features": 4,
    "pleos_plan": 5,
    "reference_files": 6,
    "reference_link": 7,
    "shortform_link": 8,
}
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")


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
        lines.append((line.replace("**", "").replace("`", ""), heading))
    return lines


def append_run(parent, value: str, base_properties=None, *, bold=False, link=False):
    run = etree.SubElement(parent, f"{{{W}}}r")
    props = deepcopy(base_properties) if base_properties is not None else etree.Element(f"{{{W}}}rPr")
    for element in props.findall("w:highlight", NS):
        props.remove(element)
    if bold and props.find("w:b", NS) is None:
        etree.SubElement(props, f"{{{W}}}b")
    if link:
        for name, setting in (("color", "002C5F"), ("u", "single")):
            element = props.find(f"w:{name}", NS)
            if element is None:
                element = etree.SubElement(props, f"{{{W}}}{name}")
            element.set(f"{{{W}}}val", setting)
    if len(props):
        run.append(props)
    text = etree.SubElement(run, f"{{{W}}}t")
    text.set(f"{{{XML}}}space", "preserve")
    text.text = value
    return run


def fill_field(control, section: str, relationships, next_id: list[int]) -> None:
    content = control.find("w:sdtContent", NS)
    if content is None:
        raise ValueError("Missing official content-control area")
    old_run = content.find("w:r", NS)
    base = None if old_run is None else old_run.find("w:rPr", NS)
    for child in list(content):
        content.remove(child)
    for index, (line, heading) in enumerate(plain_lines(section)):
        if index:
            etree.SubElement(etree.SubElement(content, f"{{{W}}}r"), f"{{{W}}}br")
        start = 0
        for match in LINK.finditer(line):
            if match.start() > start:
                append_run(content, line[start:match.start()], base, bold=heading)
            rel_id = f"rIdSHIFT{next_id[0]}"
            next_id[0] += 1
            while relationships.find(f"{{{REL}}}Relationship[@Id='{rel_id}']") is not None:
                rel_id = f"rIdSHIFT{next_id[0]}"
                next_id[0] += 1
            etree.SubElement(relationships, f"{{{REL}}}Relationship", {
                "Id": rel_id, "Type": f"{R}/hyperlink", "Target": match.group(2), "TargetMode": "External",
            })
            hyperlink = etree.SubElement(content, f"{{{W}}}hyperlink", {f"{{{R}}}id": rel_id})
            append_run(hyperlink, match.group(1), base, bold=heading, link=True)
            start = match.end()
        if start < len(line) or not line:
            append_run(content, line[start:], base, bold=heading)
    properties = control.find("w:sdtPr", NS)
    if properties is not None:
        # An inline rich-text control supports native, clickable hyperlinks.
        for name in ("showingPlcHdr", "text"):
            for element in properties.findall(f"w:{name}", NS):
                properties.remove(element)
    for parent in control.iterancestors():
        if parent.tag == f"{{{W}}}tr":
            row_properties = parent.find("w:trPr", NS)
            if row_properties is not None:
                for element in row_properties.findall("w:cantSplit", NS):
                    row_properties.remove(element)
            break


def fill_known_registration(root) -> None:
    for paragraph in root.findall(".//w:p", NS):
        values = paragraph.findall(".//w:t", NS)
        old = "".join(value.text or "" for value in values)
        new = old
        if old.startswith("앱명 / 프로젝트명:"):
            new = "앱명 / 프로젝트명: SHIFT"
        elif old.startswith("참가 단위:"):
            new = old.replace("□ 팀", "☑ 팀")
        elif old.startswith("참가 부문:"):
            new = old.replace("□ 대학(원)생", "☑ 대학(원)생")
        elif old.startswith("참가 인원:"):
            new = re.sub(r"_+", "2", old)
        if new != old and values:
            values[0].text = new
            for value in values[1:]:
                value.text = ""


def serialize(root) -> bytes:
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def build(template: Path, output: Path, source_path: Path) -> None:
    if template == output:
        raise ValueError("Keep the official original and filled draft separate")
    source = source_path.read_text(encoding="utf-8-sig")
    sections = {int(number): body for number, body in re.findall(
        r"^## (\d+) [^\n]+\n(.*?)(?=^## |\Z)", source, flags=re.M | re.S
    )}
    if not set(SECTION_BY_TAG.values()).issubset(sections):
        raise ValueError("Source must contain numbered sections 1 through 8")
    with ZipFile(template) as original:
        root = etree.fromstring(original.read("word/document.xml"))
        relationships = etree.fromstring(original.read("word/_rels/document.xml.rels"))
        controls = {}
        for control in root.findall(".//w:sdt", NS):
            tag = control.find("w:sdtPr/w:tag", NS)
            if tag is not None:
                controls[tag.get(f"{{{W}}}val")] = control
        if not set(SECTION_BY_TAG).issubset(controls):
            raise ValueError("Official template fields not found")
        next_id = [1]
        for tag, number in SECTION_BY_TAG.items():
            fill_field(controls[tag], sections[number], relationships, next_id)
        fill_known_registration(root)
        replacements = {"word/document.xml": serialize(root),
                        "word/_rels/document.xml.rels": serialize(relationships)}
        if "docProps/core.xml" in original.namelist():
            core = etree.fromstring(original.read("docProps/core.xml"))
            core_ns = {"dc": "http://purl.org/dc/elements/1.1/",
                       "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
                       "dcterms": "http://purl.org/dc/terms/"}
            metadata = {"dc:title": "SHIFT 공모전 기획서 초안", "dc:creator": "SHIFT",
                        "cp:lastModifiedBy": "SHIFT", "dc:description": "Official contest application draft",
                        "cp:revision": "1", "dcterms:modified": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
            for query, value in metadata.items():
                element = core.find(query, core_ns)
                if element is None:
                    prefix, local = query.split(":")
                    element = etree.SubElement(core, f"{{{core_ns[prefix]}}}{local}")
                element.text = value
            replacements["docProps/core.xml"] = serialize(core)
        output.parent.mkdir(parents=True, exist_ok=True)
        with ZipFile(output, "w") as target:
            for entry in original.infolist():
                target.writestr(entry, replacements.get(entry.filename, original.read(entry)))
    with ZipFile(output) as result:
        if result.testzip() is not None:
            raise ValueError("DOCX archive integrity check failed")
        checked = etree.fromstring(result.read("word/document.xml"))
        for tag in SECTION_BY_TAG:
            assert checked.xpath("//w:sdt[w:sdtPr/w:tag/@w:val=$tag]//w:t[text()]", namespaces=NS, tag=tag), tag
    print(f"Created {output}")
    print("All eight project fields filled; university team of two prefilled.")
    print("Team name, personal details, consent and signatures require team completion.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", type=Path, nargs="?", default=ROOT / "docs/templates/contest-application-consent.docx")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/SHIFT_application_draft.docx")
    parser.add_argument("--source", type=Path, default=ROOT / "docs/SUBMISSION_DRAFT.md")
    args = parser.parse_args()
    build(args.template.resolve(), args.output.resolve(), args.source.resolve())

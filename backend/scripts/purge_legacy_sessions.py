"""
Delete sessions created before per-session access tokens existed.

Those sessions have no token, so after the ownership change nobody can open
them through the API any more; this removes the data itself.

    python scripts/purge_legacy_sessions.py            # dry run: list what would go
    python scripts/purge_legacy_sessions.py --apply    # actually delete

Uses the backend selected by STORAGE_BACKEND (and the matching DATA_DIR /
GCP settings), exactly like the API server.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import settings  # noqa: E402
from db.store import get_store  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="delete instead of listing")
    args = parser.parse_args()

    ids = get_store().purge_legacy_sessions(dry_run=not args.apply)
    verb = "Deleted" if args.apply else "Would delete"
    print(f"[{settings.storage_backend}] {verb} {len(ids)} legacy session(s)")
    for sid in ids:
        print(f"  {sid}")
    if ids and not args.apply:
        print("Re-run with --apply to delete them.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
In-memory stand-ins for the subset of google-cloud-firestore / google-cloud-storage
that db.store.firestore uses. Enough to exercise FirestoreStore's logic offline
(preconditions, batches, queries); not a substitute for the real emulators.
"""
from __future__ import annotations

import copy
import itertools
from pathlib import Path

from google.api_core.exceptions import AlreadyExists, NotFound, PreconditionFailed


# ── Firestore ───────────────────────────────────────────────────────────────
class FieldFilter:
    def __init__(self, field_path, op_string, value):
        assert op_string == "=="
        self.field_path, self.value = field_path, value


class _Snap:
    def __init__(self, ref, data):
        self.reference, self.id, self._data = ref, ref.id, data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return copy.deepcopy(self._data) if self._data is not None else None


class _DocRef:
    _ids = itertools.count()

    def __init__(self, col, doc_id):
        self.col, self.id = col, doc_id or f"auto{next(self._ids)}"

    def get(self):
        return _Snap(self, self.col.docs.get(self.id))

    def create(self, data):
        if self.id in self.col.docs:
            raise AlreadyExists(self.id)
        self.col.docs[self.id] = copy.deepcopy(data)

    def set(self, data):
        self.col.docs[self.id] = copy.deepcopy(data)

    def update(self, data):
        if self.id not in self.col.docs:
            raise NotFound(self.id)
        self.col.docs[self.id].update(copy.deepcopy(data))

    def delete(self):
        self.col.docs.pop(self.id, None)


class _Agg:
    def __init__(self, value):
        self.value = value


class _Query:
    def __init__(self, col, filters):
        self.col, self.filters = col, filters

    def where(self, *, filter):
        return _Query(self.col, self.filters + [filter])

    def stream(self):
        for doc_id, data in list(self.col.docs.items()):
            if all(data.get(f.field_path) == f.value for f in self.filters):
                yield _Snap(_DocRef(self.col, doc_id), data)

    def count(self):
        n = sum(1 for _ in self.stream())
        return type("C", (), {"get": lambda _self: [[_Agg(n)]]})()


class _Collection(_Query):
    def __init__(self):
        super().__init__(self, [])
        self.docs: dict[str, dict] = {}

    def document(self, doc_id=None):
        return _DocRef(self, doc_id)


class _Batch:
    def __init__(self):
        self.ops = []

    def create(self, ref, data): self.ops.append(("create", ref, data))
    def update(self, ref, data): self.ops.append(("update", ref, data))
    def set(self, ref, data): self.ops.append(("set", ref, data))
    def delete(self, ref): self.ops.append(("delete", ref, None))

    def commit(self):
        for op, ref, _ in self.ops:   # all-or-nothing, like Firestore
            if op == "create" and ref.id in ref.col.docs:
                raise AlreadyExists(ref.id)
        for op, ref, data in self.ops:
            getattr(ref, op)(*([data] if data is not None else []))


class FirestoreClient:
    def __init__(self, project=None, database=None):
        self.cols: dict[str, _Collection] = {}

    def collection(self, name):
        return self.cols.setdefault(name, _Collection())

    def get_all(self, refs):
        return [r.get() for r in refs]

    def batch(self):
        return _Batch()


# ── Cloud Storage ───────────────────────────────────────────────────────────
class _Blob:
    def __init__(self, bucket, name):
        self.bucket, self.name = bucket, name

    @property
    def generation(self):
        return self.bucket.objects[self.name][1] if self.name in self.bucket.objects else None

    def _check(self, if_generation_match):
        current = self.generation or 0
        if if_generation_match is not None and if_generation_match != current:
            raise PreconditionFailed(self.name)

    def upload_from_string(self, data, content_type=None, if_generation_match=None):
        self.bucket.before_write(self.name)   # a concurrent writer may land first
        self._check(if_generation_match)
        self.bucket.objects[self.name] = (bytes(data), (self.generation or 0) + 1)

    def download_as_bytes(self, if_generation_match=None):
        if self.name not in self.bucket.objects:
            raise NotFound(self.name)
        self._check(if_generation_match)
        return self.bucket.objects[self.name][0]

    def upload_from_filename(self, filename):
        self.upload_from_string(Path(filename).read_bytes())

    def download_to_filename(self, filename):
        Path(filename).write_bytes(self.download_as_bytes())

    def delete(self):
        if self.name not in self.bucket.objects:
            raise NotFound(self.name)
        del self.bucket.objects[self.name]


class Bucket:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, int]] = {}
        self.before_write = lambda name: None   # hook to simulate concurrent writers

    def blob(self, name):
        return _Blob(self, name)

    def get_blob(self, name):
        return _Blob(self, name) if name in self.objects else None


class StorageClient:
    shared_bucket: Bucket | None = None

    def __init__(self, project=None):
        pass

    def bucket(self, name):
        return StorageClient.shared_bucket


def install(monkeypatch):
    """Point google.cloud.firestore / storage at the fakes; returns the shared bucket."""
    from google.cloud import firestore, storage

    StorageClient.shared_bucket = Bucket()
    monkeypatch.setattr(firestore, "Client", FirestoreClient)
    monkeypatch.setattr(firestore, "FieldFilter", FieldFilter)
    monkeypatch.setattr(storage, "Client", StorageClient)
    return StorageClient.shared_bucket

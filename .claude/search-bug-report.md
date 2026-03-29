# 검색 기능 버그 리포트 — oh-my-project-knowledge website-spec

## 요약

`_site/` 정적 웹사이트의 검색 기능이 동작하지 않는 버그가 2건 있습니다.

---

## 버그 1: search-index.json 생성 형식이 스펙과 불일치

### 스펙 정의 (website-spec)

```json
{
  "version": 1,
  "generatedAt": "YYYY-MM-DD",
  "entries": [...]
}
```

### 실제 생성 결과

```json
[
  { "id": "jira-POL-001", ... },
  ...
]
```

### 영향

`app.js`는 스펙대로 `data.entries`로 접근하므로 배열이 직접 반환되면 `undefined` → 검색 인덱스가 빈 배열로 초기화 → 모든 검색이 "검색 결과가 없습니다" 반환.

### 수정 방향

**둘 중 하나 선택:**

- **(A) 생성 로직 수정:** search-index.json을 스펙대로 `{ "version": 1, "generatedAt": "...", "entries": [...] }` 형태로 생성
- **(B) app.js 수정:** `data.entries` 대신 `Array.isArray(data) ? data : (data.entries || [])` 로 방어 처리

→ **(A)를 권장.** 스펙과 구현이 일치해야 하며, version/generatedAt 메타 정보도 유용함.

---

## 버그 2: file:// 프로토콜에서 fetch() 차단

### 현상

```
app.js:60 GET file:///.../_site/search-index.json net::ERR_FAILED
```

### 원인

`_site/`는 외부 의존 없이 로컬에서 직접 여는 정적 사이트인데, `fetch()`는 `file://` 프로토콜에서 브라우저 CORS 정책에 의해 차단됩니다. Chrome, Edge 등 Chromium 계열에서 공통 발생.

### 수정 방향

**`fetch()` 대신 `<script>` 태그로 인덱스 로드:**

1. search-index.json 대신 (또는 추가로) `assets/search-index.js` 생성:
   ```js
   var SEARCH_INDEX = { "version": 1, "entries": [...] };
   ```

2. 모든 HTML 파일에서 `app.js` 앞에 스크립트 태그 추가:
   ```html
   <script src="{상대경로}/assets/search-index.js"></script>
   <script src="{상대경로}/assets/app.js"></script>
   ```

3. `app.js`에서 fetch 로직 제거, 전역 변수 참조:
   ```js
   var searchIndex = (typeof SEARCH_INDEX !== 'undefined')
     ? SEARCH_INDEX.entries
     : [];
   ```

### website-spec 반영 필요 사항

- **파일 구조:** `assets/search-index.js` 추가 (또는 search-index.json → search-index.js 대체)
- **HTML 공통 템플릿:** `<script src="assets/search-index.js">` 추가
- **JS 동작 명세 > 검색 섹션:** fetch → 전역 변수 참조로 변경

---

## 변경 필요 파일 (스킬 내부)

| 파일 | 변경 내용 |
|---|---|
| `skills/website-spec/` | 파일 구조에 `search-index.js` 추가, HTML 템플릿에 script 태그 추가, JS 검색 명세 수정 |
| search-index.json 생성 로직 | 스펙 형식(`{ version, entries }`) 준수 또는 `.js` 파일로 출력 |
| `app.js` 생성 템플릿 | fetch 제거 → `SEARCH_INDEX` 전역 변수 참조 |

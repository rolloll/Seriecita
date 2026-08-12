# Seriecita

구글 플레이북스(`play.google.com/books`) 웹 라이브러리에는 여러 권으로 된 시리즈를 한데 묶어 보여주는 기능이 없습니다. 소장한 책이 많아지면 같은 시리즈의 1권, 2권, 외전이 서재 곳곳에 흩어져 보입니다.

Seriecita는 브라우저 확장으로 라이브러리 화면에 개입해서, 제목의 권수 표기를 인식해 같은 시리즈를 자동으로 하나의 "덱"으로 접어 보여주는 크롬/엣지(Manifest V3) 확장입니다. 구글 서버나 계정 데이터를 건드리지 않고, 브라우저에서 보이는 화면만 클라이언트 사이드로 재구성합니다.

## 기능

- **시리즈 자동 감지 및 묶기**: 제목이 `1권`, `2`, `외전1`, `(외전 1)`, `번외`처럼 끝나는 패턴을 인식해 같은 베이스 제목 + 같은 저자의 책을 한 시리즈로 묶습니다. 실제로 2권 이상 소장한 경우에만 묶입니다(1권만 있으면 묶을 대상이 없으므로 그대로 둡니다).
- **덱 형태 표시**: 묶인 시리즈는 대표 표지(가장 낮은 권번호) 하나만 보이고, 표지 우하단에 `총 N권 ›` 배지가 뜹니다. 배지를 클릭하면 해당 시리즈만 펼쳐져서 전체 권이 순서대로 나열되고, 상단에 제목 + 접기 버튼이 있는 헤더가 나타납니다.
- **시리즈 전체 선택**: 펼친 시리즈 헤더의 "전체 선택" 버튼을 누르면 그 시리즈의 모든 권에 대해 구글 기본 "선택" 체크박스를 순서대로 눌러줍니다. 이후 구글 자체의 선택 툴바(삭제, 서가에 추가 등)를 그대로 사용할 수 있습니다.
- **작가별 모아보기**: 각 책의 작가 이름 옆에 있는 "모아보기"를 클릭하면 서재 전체가 그 작가의 책들만 보이도록 필터링됩니다. 화면 우하단에 뜨는 필터 칩의 ✕를 누르면 해제됩니다.
- **켜기/끄기 토글**: 화면 우하단의 `Seriecita: ON/OFF` 버튼으로 언제든 원래 구글 뷰로 되돌릴 수 있습니다. 상태는 `chrome.storage.local`에 저장되어 다음 방문에도 유지됩니다.
- **업데이트 알림**: 백그라운드에서 6시간마다 이 저장소의 [최신 릴리스](https://github.com/rolloll/Seriecita/releases/latest)를 확인합니다. 새 버전이 있으면 데스크톱 알림이 뜨고(클릭하면 릴리스 페이지로 이동), 플레이북스 탭을 보고 있다면 우하단에 초록색 `Seriecita vX.X.X 업데이트 ›` 배너도 함께 뜹니다. 같은 버전으로는 한 번만 알립니다.
- **작가별/발행연도별/출판사별 분류**: 화면 우상단의 분류 바에서 하나를 고르면 서재 전체가 그 기준으로 섹션이 나뉘어 보입니다(시리즈로 묶인 책은 대표 1권 기준으로 분류). 작가는 이미 화면에 있는 정보라 즉시 적용되지만, 발행연도/출판사는 Google Books API에서 각 책의 정보를 가져와야 해서 분류 바에 "메타데이터 불러오는 중 (N/M)"이 표시되며, 값이 없는 책은 "(연도 미확인)"/"(출판사 미확인)" 섹션에 모입니다. 한 번 가져온 정보는 계속 캐시됩니다.
- **수동으로 시리즈 묶기**: 자동 인식이 놓친 시리즈(제목에 권수 표기가 없거나 표기 방식이 다른 경우)를 위해, 화면 좌하단 "수동 묶기"를 켜면 각 표지 좌상단에 선택 체크박스가 나타납니다. 2권 이상 선택 후 "시리즈로 묶기"를 누르고 이름을 입력하면 그 책들이 하나의 덱으로 묶입니다. 자동 인식 시리즈와 동일하게 배지/펼치기/전체 선택을 지원하고, 펼친 상태의 헤더에서 "그룹 삭제"로 묶음만 해제할 수 있습니다(책 자체는 그대로 남습니다).

## 설치 (사용자용)

1. [최신 릴리스](https://github.com/rolloll/Seriecita/releases/latest)에서 zip을 내려받아 압축을 풀거나, 이 저장소를 클론합니다.
2. 크롬: `chrome://extensions` / 엣지: `edge://extensions` 접속
3. **개발자 모드** 켜기 (엣지는 좌측 하단, 크롬은 우측 상단)
4. **"압축해제된 확장 프로그램 로드"** 클릭 → 압축을 푼 폴더(또는 클론한 폴더) 선택
5. `play.google.com/books` 새로고침

업데이트가 나오면 알림/배너가 안내하는 릴리스 페이지에서 새 zip을 받아 같은 폴더에 덮어쓴 뒤, 확장 목록에서 Seriecita 카드의 **"다시 로드"** 를 누르면 반영됩니다.

## 설정

확장 아이콘 우클릭 → **옵션**(또는 `chrome://extensions`에서 Seriecita의 "세부정보 → 확장 프로그램 옵션")에서 Google Books API 키를 등록할 수 있습니다. 발행연도/출판사 분류가 각 책마다 `GET https://www.googleapis.com/books/v1/volumes/{id}`를 호출하는데, 키 없이도 동작하지만 비인증 요청은 한도가 낮아 책이 많으면 429 오류가 날 수 있습니다. 키는 Seriecita 자신의 `chrome.storage.local`에만 저장되고 다른 곳으로 전송되지 않습니다.

## 프로젝트 구조 (개발자용)

```
manifest.json   Manifest V3 정의. content_scripts로 content.js/content.css를
                https://play.google.com/books* 에 주입.
                background.js를 서비스 워커로, options/를 옵션 페이지로 등록.
content.js      라이브러리 화면 로직 (아래 "동작 방식" 참고)
content.css     주입되는 배지/헤더/토글/분류바/체크박스 등 UI 스타일
background.js   ① 6시간마다 GitHub Releases API로 최신 버전을 확인해 알림
                ② content.js가 요청한 volume id들을 Google Books API로
                   순차 조회해 chrome.storage.local(`seriecitaMetaCache`)에 캐시
options/        API 키를 입력하는 간단한 설정 페이지 (options_ui)
icon*.png       툴바/관리 페이지용 아이콘 (16/48/128px)
```

별도 빌드 과정이 없습니다 — 파일을 그대로 브라우저가 읽습니다.

## 동작 방식

플레이북스 라이브러리는 Angular 앱이라 DOM을 직접 옮기면 다음 변경 감지 사이클에서 되돌려질 위험이 있습니다. 그래서 두 가지 원칙으로 구현했습니다.

1. **카드 노드는 절대 이동하지 않는다.** 대신 각 `<gpb-volume-card>`에 인라인 `style.order`(CSS Grid의 시각적 순서)와 `style.display`만 건드립니다. 실제 DOM 트리 구조는 Angular가 관리하는 그대로 둡니다.
2. **우리가 만든 노드만 직접 추가/삭제한다.** 시리즈 헤더, 배지, "모아보기" 버튼, 필터 칩은 모두 Seriecita가 만들어서 붙인 노드이며 `data-seriecita-*` 속성으로 표시해 다음 리렌더 시 정리(`remove()`) 후 다시 그립니다.

핵심 함수 (`content.js`):

- `parseSeries(title)`: 제목 문자열에서 시리즈 베이스 제목/권번호/종류(`volume`/`sidestory`/`extra`/`single`)를 뽑아내는 정규식 휴리스틱. 구글 쪽에 시리즈 메타데이터 API가 없어서(Google Books API의 `mylibrary`는 Play 스토어 구매 도서에 적용되지 않음) 제목 텍스트만으로 판단합니다.
- `computeEntries(cards)`: 먼저 `customGroups`(수동 묶음, volume id 기준)로 묶을 수 있는 카드를 떼어내고, 남은 카드만 `베이스 제목|저자` 키로 자동 그룹화합니다. 2권 이상이면 그룹, 아니면 단행본으로 분류하고, 그룹 내부는 권번호 → 종류 순으로 정렬합니다. 수동 묶음이 자동 인식보다 항상 우선합니다.
- `buildBuckets(entries)`: `classifyMode`(작가/연도/출판사)에 따라 entries를 섹션으로 나누고 정렬합니다(연도는 최신순, 나머지는 가나다순). 분류를 안 쓰면 섹션 하나로 통과시켜 기존 동작과 동일합니다.
- `applyGrouping(grid)`: 매번 처음부터 다시 계산해서 그린다(헤더/배지/분류헤더를 지우고 재생성) — 상태를 DOM에서 다시 읽어오는 대신 `expandedKeys`, `authorFilter`, `classifyMode`, `customGroups`, `metaCache`를 모듈 스코프에 들고 있다가 그대로 반영.
- `getGrid()`: 그리드 컨테이너를 CSS 클래스명이 아니라 `document.querySelector('gpb-volume-card').parentElement`로 찾습니다. 구글이 클래스명을 바꿔도 깨지지 않도록 하기 위함입니다.
- 재실행 트리거: `document.body`에 걸어둔 `MutationObserver`(childList/subtree)가 정렬 변경, 지연 로딩, 화면 이동/복귀를 모두 감지해 300ms 디바운스 후 재적용. 우리가 만든 mutation에 스스로 반응하지 않도록 `isApplying` 플래그로 가드.

수동 묶기(`customGroups`)와 분류(`classifyMode`/`metaCache`)는 각각 `chrome.storage.local`의 `seriecitaCustomGroups`, `seriecitaClassifyMode`, `seriecitaMetaCache`에 저장되어 브라우저를 재시작해도 유지됩니다. `getVolumeId(card)`가 카드의 `a.title` href(`.../reader?id=XXXX`)에서 뽑아내는 volume id가 이 세 기능 모두의 공통 키입니다.

메타데이터 조회 흐름: `content.js`가 분류 모드를 연도/출판사로 바꾸면 캐시에 없는 id들을 `chrome.runtime.sendMessage({type:'seriecitaFetchMetadata', ids})`로 background에 넘기고, background는 `https://www.googleapis.com/books/v1/volumes/{id}`를 하나씩(150ms 간격) 호출해 `seriecitaMetaCache`에 채웁니다. content.js는 `chrome.storage.onChanged`로 캐시 갱신을 구독해서 데이터가 도착하는 대로 다시 그립니다.

업데이트 확인 흐름(`background.js`):

1. 설치 시 및 6시간마다(`chrome.alarms`) `GET https://api.github.com/repos/rolloll/Seriecita/releases/latest` 호출
2. 받아온 `tag_name`(`v1.1.0` 형식)을 `chrome.runtime.getManifest().version`과 숫자 비교(`compareVersions`)
3. 더 높은 버전이면 `seriecitaUpdateAvailable`에 `{version, url}` 저장 + (버전당 최초 1회) `chrome.notifications.create`
4. `content.js`는 `chrome.storage.onChanged`로 이 값을 구독해서 배너를 띄우거나 지움

새 릴리스를 낼 때는 `manifest.json`의 `version`을 올리고, 그 버전과 같은 태그(`vX.X.X`)로 GitHub Release를 만들어야 이 메커니즘이 인식합니다.

### 설계 노트: Peek-A-Book과의 관계

같은 개발자의 [Peek-A-Book](https://github.com/rolloll/peek-a-book) 확장도 Google Books API로 발행연도/출판사 등을 다룹니다. 하지만 서로 다른 확장은 storage나 코드를 공유하지 못하고, 진짜로 연동하려면 두 확장 모두에 고정 `key`(고정 extension id)와 `externally_connectable`을 추가해야 해서 한쪽만 설치돼도 깨지는 등 결합이 생깁니다. 그래서 Seriecita는 Peek-A-Book과 무관하게 Google Books API를 직접 호출하도록 독립적으로 구현했습니다 — 설정도 더 간단하고, Peek-A-Book 없이도 동작합니다.

## 알려진 한계

- 제목에 권수 표기가 전혀 없는 시리즈(부제만 다른 경우)는 자동으로 인식하지 못합니다 — 이런 경우 "수동 묶기"를 사용하세요.
- "전체 선택"은 구글의 내부 "Select"/"선택" 버튼을 라벨 텍스트로 찾아 클릭하는 방식이라, 구글이 마크업이나 라벨을 바꾸면 조용히 동작하지 않을 수 있습니다.
- Google Play Books 자체 UI 변경(클래스명 변경, DOM 구조 변경)에 대한 자동 테스트가 없습니다. 문제가 생기면 `content.js`의 셀렉터(`gpb-volume-card`, `.metadata`, `.cover`, `a.title`)를 다시 확인하세요.
- 업데이트 확인은 GitHub Releases API를 비인증으로 호출하므로 시간당 요청 한도(IP당 60회)가 있습니다. 개인 사용 범위에서는 문제 없는 수준입니다.
- 발행연도/출판사 조회는 Google Books의 volume id 조회 API를 쓰는데, 이 값이 실제로 없는 책(자체 출판, 등록되지 않은 도서 등)은 "미확인"으로 분류됩니다. API 키 없이 대량 조회 시 429가 나면 잠시 후 분류를 다시 선택해 재시도하세요.
- 수동 묶기로 만든 그룹은 이름 변경이나 책 추가/제거 UI가 아직 없습니다. 다시 만들려면 기존 그룹을 삭제하고 새로 묶어야 합니다.

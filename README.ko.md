# Variable Token Checker

**두 프레임**(예: 라이트/다크, 또는 변경 전/후)을 골라, 대응되는 레이어들이
**같은 디자인 토큰** — 변수(variable) **와** 컬러 스타일(color style) — 에
바인딩됐는지 비교하는 Figma 플러그인. **하드코딩**, **토큰 불일치**, **구조
차이**를 잡아내고, 두 프레임의 레이어 이름을 맞춰주는 기능도 있습니다.

## 왜 필요한가

한 화면과 그 변형을 나란히 만들면, 모든 레이어가 같은 토큰을 가리켜야 하고
값(mode)만 달라야 합니다. 하지만 색을 하드코딩하거나, 비슷한 토큰으로 바꿔치거나,
변수 대신 컬러 스타일을 쓰거나, 한쪽에만 레이어를 추가하는 식의 drift가 쉽게
생깁니다. 이 플러그인이 그걸 전부 드러냅니다.

## 무엇을 검사하나

**토큰(token)** = 참조되는 디자인 토큰 = **변수** 또는 **컬러 스타일**.
매칭된 속성마다 판정(verdict)이 붙습니다:

| A 상태 | B 상태 | 결과 |
|---|---|---|
| token X | token X | **Matched** |
| token X | token Y (변수↔스타일 포함) | **diff-token** |
| token | hardcoded | **one-hardcoded** |
| hardcoded | hardcoded | **both-hardcoded** (warn) |
| token | absent / mixed | **structure-prop** |

- **변수**는 paint 단위(`fills[i].color`, `strokes[i].color`) 및 스칼라 속성에서
  읽고, 매칭되면 **Mode × Value** 표(색 스와치 포함)를 보여줍니다.
- **컬러 스타일**(노드 단위 `fillStyle` / `strokeStyle`)도 토큰으로 감지·비교하여,
  스타일 적용 레이어가 하드코딩으로 오인되지 않습니다.

### 비교 범위

| 그룹 | 속성 |
|---|---|
| 색상 | `fills[i].color`, `strokes[i].color` (SOLID); fill/stroke **컬러 스타일** |
| 스칼라 | `cornerRadius` (+ 네 모서리), `opacity`, `paddingLeft/Right/Top/Bottom`, `itemSpacing` |
| 텍스트 | `fontSize`, `lineHeight`, `letterSpacing`, `fontWeight` |

gradient / image 페인트는 감지만 하고 상세 비교는 안 합니다.

## 레이어 페어링

1. **정확한 경로(pathKey)** — 루트부터의 레이어 이름 체인, 동명 형제는 `[0]`,
   `[1]` 인덱스로 구분.
2. **이름 폴백** — 경로로 안 맞으면 **같은 그룹 내 같은 레이어 이름**끼리 다시
   짝지어 비교(행에 `name` 태그 표시).

## UI

- **탭**: Matched · Mismatches · Structure · Hardcoded.
- **최상위 컴포넌트 단위 그룹** — 공통 프레임/래퍼 경로를 자동으로 벗겨내고
  실제로 갈라지는 레벨부터 그룹.
- **접이식 카드** + A/B **썸네일**, 썸네일 배경은 각 프레임의 모드(라이트/다크
  토큰)에 맞춰져 식별이 쉬움.
- 리스트는 **Y 위치 기준 위→아래** 정렬.
- **카드 클릭** → 매칭된 레이어 쌍 선택(화면 이동 없음), 현재 선택은 실시간
  하이라이트. sub-row 클릭 시 해당 하위 레이어 선택.
- **Unify Layer Names** — 매칭 쌍의 B쪽 레이어 이름을 A에 맞춰 통일.
- **Compare** 로 재분석, 우측 하단 핸들 드래그로 크기 조절.

## 설치 (개발 모드)

1. `npm install`
2. `npm run build` → `dist/code.js`, `dist/ui.html` 생성.
3. Figma 데스크톱 → **Plugins → Development → Import plugin from manifest…**
   → 이 폴더의 `manifest.json` 선택.

`dist/` 는 커밋돼 있어서, 소스를 수정할 때만 1~2단계가 필요합니다.

## 사용

1. 토큰을 공유해야 하는 두 프레임을 **정확히 2개** 선택.
2. **Plugins → Development → Variable Token Checker** 실행.
3. 탭을 확인하고, 카드를 펼쳐 각 레이어의 결과를 봄.
4. 항목 클릭 → 캔버스에서 해당 레이어 선택.
5. 선택을 바꾼 뒤 **Compare**.

## 개발

```bash
npm run watch       # esbuild watch (재빌드 + ui.html 복사)
npm run typecheck   # tsc --noEmit
npm test            # compare.ts 순수 로직 단위 테스트 (node --test)
```

### 프로젝트 구조

```
variable-token-checker/
├─ manifest.json
├─ package.json
├─ tsconfig.json
├─ build.mjs              # esbuild + ui.html 복사
├─ src/
│  ├─ code.ts             # Figma 메인 스레드 (snapshot, 변수/스타일 해석, 썸네일)
│  ├─ compare.ts          # 순수 비교 + 그룹 로직 (Figma API 무관, 테스트 가능)
│  ├─ types.ts            # 공유 스키마 + 메시지 타입
│  └─ ui.html             # UI 스레드 (리포트 렌더)
├─ test/
│  └─ compare.test.mjs    # 판정 매트릭스, 그룹, 이름 폴백, 스타일
└─ dist/                  # 빌드 산출물 (커밋됨, 매니페스트가 참조)
```

### 변경 흐름

`src/*` 수정 → `npm run build` → Figma에서 플러그인 재실행.
타입 변경 시 `npm run typecheck`, 비교 로직 변경 시 `npm test`.

## 매니페스트 메모

- `documentAccess: "dynamic-page"` 사용. 변수/스타일 조회는 **반드시 async**
  (`getVariableByIdAsync`, `getStyleByIdAsync` 등).
- `networkAccess: { allowedDomains: ["none"] }` — 외부 통신 없음.

## 라이센스

소스 공개(source-available) 라이센스 — MIT를 베이스로 하되, **이 코드를
Figma 플러그인으로 배포**(Community 게시, 사내/조직 플러그인, 기타 제3자에게
실행 가능한 형태로 배포)하려면 **사전 서면 허락이 필요**합니다. 읽기·학습·
기여 목적의 포크·내부 평가·개인 수정은 자유입니다.

전문은 [LICENSE](LICENSE) 참조.

## 알려진 한계

- effects / gradient / image 페인트는 **감지만** 하고 상세 비교 안 함.
- 텍스트 스타일(`textStyleId`)·이펙트 스타일은 아직 비교 안 함 (fill/stroke
  컬러 스타일은 지원).
- 3개 이상 모드 / 다중 컬렉션 교차검증 미지원.

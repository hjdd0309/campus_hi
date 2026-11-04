// 학과 전용 체험: 특정 학교·학과의 학년 자리를 학과군 규칙 대신 이 데이터로 채운다(model.js의 createDepartment).
// 학년 자리 하나에 체험(parts)을 1~3개 넣을 수 있고, 차례로 모두 해야 그 학년 체험을 마친다.
// subjects는 그 학년에 실제로 편성된 과목이다. 과목마다 이름의 출처(source)를 적는다.
//   "공시": 대학 공시 자료(courses.csv.gz)의 교과목명. 학교 편성표 학년(year_curricula.json)이 있으면 그 학년과 같아야 한다.
//   "편성표": 학교 교육과정 편성표의 과목명(공시 자료에 없거나 이름이 다를 때). 그 편성표를 넣은 학년 자료(같은 주소·연도)에
//             같은 학년으로 있어야 한다. 공시 자료 이름이 다르면 alias에 공시 이름을 적는다(학년 자료의 names로 확인).
// 학과의 source는 학년을 확인한 편성표(주소·연도)다. 다른 학교 편성표도 backend/pipeline.py import로 넣고 같은 방식으로 쓴다.
// status: "review"(검토 대기) | "verified"(공개). AI가 쓴 데이터는 쓰지 않은 별도 에이전트가 검토한 뒤에만 verified로 바꾼다.
// 체험 데이터 형식은 experiences.js의 틀 형식과 같다(학과 전용 틀 H~M은 studio.js).
import { cleanExperience } from "./experiences.js";

const text = (value, max) => (typeof value === "string" && value.trim() && [...value].length <= max ? value : null);

// 소실점 탐정(틀 M)의 라운드. 장면 좌표는 0~360 × 0~400, 고르기 스케치는 0~120 × 0~120이다.
// 모서리(edges)는 늘리면 정답 소실점을 지난다(형식 검사에서 확인한다). R2의 두 소실점은 같은 높이(눈높이)에 있다.
export const vanishingRounds = [
  {
    id: "r1",
    type: "pin",
    title: "복도의 소실점을 찾아요",
    hint: "바닥과 천장 선이 어디로 모이나요?",
    scene: [
      [20, 400, 132, 239], [340, 400, 228, 239], [20, 0, 132, 119], [340, 0, 228, 119],
      [132, 119, 228, 119], [228, 119, 228, 239], [228, 239, 132, 239], [132, 239, 132, 119],
    ],
    edges: [
      { from: [20, 400], to: [84, 308], vp: 0 },
      { from: [340, 400], to: [276, 308], vp: 0 },
      { from: [20, 0], to: [84, 68], vp: 0 },
      { from: [340, 0], to: [276, 68], vp: 0 },
    ],
    answer: [[180, 170]],
    pinStart: [[180, 330]],
    explain: "복도의 모든 선이 막다른 벽 가운데쯤의 한 점으로 모였어요. 1점 투시는 정면에서 볼 때 써요.",
  },
  {
    id: "r2",
    type: "pin",
    title: "스피커 상자의 소실점 2개를 찾아요",
    hint: "왼쪽 면 선과 오른쪽 면 선이 각각 다른 곳으로 모여요.",
    scene: [
      [180, 150, 180, 300],
      [180, 150, 116, 170], [180, 300, 116, 260], [116, 170, 116, 260],
      [180, 150, 244, 170], [180, 300, 244, 260], [244, 170, 244, 260],
    ],
    edges: [
      { from: [180, 150], to: [116, 170], vp: 0 },
      { from: [180, 300], to: [116, 260], vp: 0 },
      { from: [180, 150], to: [244, 170], vp: 1 },
      { from: [180, 300], to: [244, 260], vp: 1 },
    ],
    answer: [[20, 200], [340, 200]],
    pinStart: [[90, 340], [270, 340]],
    explain: "두 소실점이 같은 높이에 있죠? 이 높이가 내 눈높이(수평선)예요. 제품 스케치는 대부분 2점 투시로 그려요.",
  },
  {
    id: "r3",
    type: "pick",
    title: "투시가 틀린 스케치는?",
    options: [
      { id: "a", lines: [[20, 50, 70, 50], [70, 50, 70, 100], [70, 100, 20, 100], [20, 100, 20, 50], [20, 50, 41, 44], [70, 50, 76, 44], [70, 100, 76, 79], [41, 44, 76, 44], [76, 44, 76, 79]] },
      { id: "b", lines: [[60, 50, 60, 100], [60, 50, 39, 57], [60, 100, 39, 87], [39, 57, 39, 87], [60, 50, 81, 57], [60, 100, 81, 87], [81, 57, 81, 87]] },
      { id: "c", lines: [[35, 50, 75, 50], [75, 50, 75, 90], [75, 90, 35, 90], [35, 90, 35, 50], [35, 50, 21, 55], [75, 50, 71, 55], [75, 90, 71, 105], [35, 90, 21, 105], [21, 55, 71, 55], [71, 55, 71, 105], [71, 105, 21, 105], [21, 105, 21, 55]] },
    ],
    answer: "c",
    explain: "C는 뒷면이 앞면보다 커요. 멀리 있는 면은 작아져야 하는데 반대로 커져서 상자가 뒤틀려 보여요. 이걸 '역투시'라고 해요.",
  },
];

const raw = {
  "경희대학교|산업디자인학과": {
    source: {
      title: "2025학년도 예술·디자인대학 교육과정 [별표1] 산업디자인학과 교육과정 편성표",
      url: "https://dc.khu.ac.kr/dc/cmmn/file/fileDown.do?menuNo=15400056&atchFileId=264fb13d9a0a4c17ba986b274cef66be&fileSn=1&bbsId=",
      year: 2025,
      checkedAt: "2026-11-04",
    },
    years: {
      // 편성표에서 드로잉(FD101)과 평면디자인(FD103)은 둘 다 1학년 전공기초 과목이다.
      1: {
        status: "verified",
        subjects: [
          { name: "드로잉", source: "공시" },
          { name: "평면디자인", source: "공시" },
        ],
        parts: [
          {
            template: "M",
            title: "소실점 탐정",
            task: "복도와 상자의 소실점을 핀으로 찾고, 투시가 틀린 스케치를 골라요.",
            cards: [
              {
                title: "멀리 있을수록 한 점으로 모여요",
                body: "기찻길은 멀어질수록 좁아지다가 한 점에서 만나는 것처럼 보여요. 이 점을 '소실점'이라고 해요.",
              },
              {
                title: "1점 투시와 2점 투시",
                body: "디자이너는 제품을 그릴 때 이 점을 먼저 찍고, 멀어지는 쪽으로 뻗는 선을 그 점으로 모아서 그려요. 소실점이 1개면 1점 투시, 2개면 2점 투시예요.",
              },
            ],
            subject: "드로잉",
            rounds: vanishingRounds,
            done: "디자이너는 이 선들을 머릿속으로 긋고 그려요",
            question: "투시를 알고 나서 주변 물건이 다르게 보였나요?",
            explanation:
              "나란한 선은 멀어질수록 한 점(소실점)으로 모여 보여요. 디자이너는 소실점을 먼저 정하고 선을 그 점으로 모아 그려서, 형태가 뒤틀리지 않은 스케치를 그려요.",
          },
          {
            template: "I",
            title: "색 맞추기",
            task: "잠깐 본 색을 기억해 색상·명도·채도를 슬라이더로 맞춰 똑같이 만들어요.",
            cards: [
              {
                title: "색의 세 속성",
                body: "색은 색상(빨강·파랑 같은 색의 종류), 명도(밝고 어두운 정도), 채도(맑고 탁한 정도, 곧 선명한 정도) 세 가지로 나눠 말할 수 있어요.",
              },
              {
                title: "화면 색 정하기",
                body: "이 체험의 슬라이더는 화면 색을 정하는 HSL 값이라, 미술 시간에 배우는 먼셀 명도·채도와 꼭 같지는 않아요. 그래도 세 값을 따로 맞춘다는 점은 같아요.",
              },
              {
                title: "일치율",
                body: "두 색이 얼마나 다른지는 색차(ΔE)라는 값으로 재요. 이 체험은 내가 만든 색과 목표색의 색차가 작을수록 일치율을 높게 매겨요.",
              },
            ],
            targets: [
              { h: 4, s: 78, l: 56 },
              { h: 46, s: 92, l: 58 },
              { h: 162, s: 55, l: 40 },
              { h: 214, s: 70, l: 46 },
              { h: 286, s: 38, l: 62 },
            ],
            showMs: 1000,
            prompt: "목표색이 1초 동안 보였다가 사라져요. 기억한 색을 세 슬라이더로 만들고 확인을 눌러요.",
            explanation:
              "색은 색상·명도·채도로 나눠 말할 수 있어요. 디자이너는 '조금 더 밝은 파랑'처럼 느낌으로만 말하지 않고 값으로 정해 색을 정확하게 전해요.",
          },
        ],
      },
      // 편성표에서 기초산업디자인1(ID2003, 공시 자료 이름 "기초산업디자인 1")과 리빙제품디자인(ID2023, 편성표에만 있음)은 2학년 과목이다.
      2: {
        status: "verified",
        subjects: [
          { name: "기초산업디자인 1", source: "공시" },
          { name: "리빙제품디자인", source: "편성표" },
        ],
        parts: [
          {
            template: "J",
            title: "사용자 인터뷰",
            task: "머그컵을 쓰는 어르신과 이야기하며 질문을 골라, 숨은 불편함을 찾아요.",
            cards: [
              {
                title: "열린 질문",
                body: "'어떻게', '어떤 때', '이야기해 주세요'처럼 답을 정해 두지 않은 질문이에요. 사용자가 자기 경험을 자세히 말하게 돼요.",
              },
              {
                title: "유도 질문과 닫힌 질문",
                body: "'편하시죠?'처럼 원하는 답을 넣은 질문은 맞장구만 이끌어 내요. '예/아니오'나 숫자처럼 짧은 답으로 끝나는 닫힌 질문은 사실 확인엔 좋지만 이유를 듣기 어려워요.",
              },
              {
                title: "인사이트와 컨셉",
                body: "인터뷰에서 알게 된, 사용자의 숨은 불편함이나 필요를 인사이트라고 해요. 디자이너는 인사이트를 근거로 무엇을 만들지(컨셉) 정해요.",
              },
            ],
            persona: { label: "어르신", note: "72세 · 이 체험을 위한 가상 인물" },
            opening: "안녕하세요. 저는 매일 아침 머그컵에 따뜻한 차를 마셔요. 궁금한 걸 물어보세요.",
            prompt: "턴마다 질문 하나를 골라요. 어떤 질문을 하느냐에 따라 들을 수 있는 이야기가 달라져요.",
            turns: [
              {
                choices: [
                  {
                    kind: "open",
                    ask: "컵으로 차를 드실 때 어떻게 하시는지 처음부터 이야기해 주시겠어요?",
                    reply: "물을 붓고 손잡이에 손가락을 넣어 들어요. 그런데 요즘 손가락 마디가 굵어져서 손잡이에 잘 안 들어가요.",
                    insight: "tight",
                  },
                  { kind: "leading", ask: "이 컵, 쓰기 편하시죠?", reply: "네, 뭐… 그냥 쓰는 거죠." },
                  { kind: "closed", ask: "컵을 하루에 몇 번 쓰세요?", reply: "세 번쯤이요." },
                ],
              },
              {
                choices: [
                  { kind: "leading", ask: "손잡이가 크면 더 좋으시겠죠?", reply: "그렇겠죠, 아마." },
                  {
                    kind: "open",
                    ask: "컵을 들 때 가장 신경 쓰이는 순간은 언제예요?",
                    reply: "차를 가득 담으면 무거워서, 가는 손잡이가 손가락을 파고들어 아파요.",
                    insight: "thin",
                  },
                  { kind: "closed", ask: "컵이 무거운 편인가요?", reply: "조금요." },
                ],
              },
              {
                choices: [
                  { kind: "closed", ask: "이 컵은 어르신만 쓰세요?", reply: "아니요." },
                  {
                    kind: "open",
                    ask: "이 컵을 다른 사람이 쓴 적이 있다면, 그때 이야기를 들려주세요.",
                    reply: "주말엔 여덟 살 손녀가 같은 컵으로 우유를 마셔요. 손잡이가 두꺼우면 작은 손으로 못 잡더라고요.",
                    insight: "child",
                  },
                  { kind: "leading", ask: "다른 가족분도 이 컵을 좋아하시죠?", reply: "그럼요, 좋아하죠." },
                ],
              },
              {
                choices: [
                  { kind: "leading", ask: "예쁜 컵이 있으면 바꾸실 거죠?", reply: "글쎄요, 그렇겠죠." },
                  { kind: "closed", ask: "컵이 뜨거워지나요?", reply: "네." },
                  {
                    kind: "open",
                    ask: "컵 몸통이 아니라 손잡이를 잡으시는 이유가 궁금해요. 어떤 때 그러세요?",
                    reply: "뜨거운 차를 담으면 몸통이 뜨거워서 못 잡아요. 그래서 손잡이로만 들어야 해요.",
                    insight: "hot",
                  },
                ],
              },
            ],
            insights: [
              { id: "tight", text: "손가락 마디가 굵어 손잡이 구멍이 좁게 느껴진다" },
              { id: "thin", text: "차를 가득 담으면 가는 손잡이가 손가락을 파고든다" },
              { id: "child", text: "손이 작은 손녀도 같은 컵을 쓴다" },
              { id: "hot", text: "몸통이 뜨거워 손잡이로만 들어야 한다" },
            ],
            conceptPrompt: "찾은 인사이트를 보고, 만들 머그의 컨셉을 한 줄 골라요.",
            concepts: [
              { text: "어르신과 손녀가 함께 쓰는, 손가락이 편히 들어가는 머그", needs: ["tight", "child"] },
              { text: "가득 담아도 손가락이 아프지 않은 손잡이의 머그", needs: ["thin", "hot"] },
              { text: "요즘 유행하는 색과 무늬를 담은 머그", needs: [] },
            ],
            explanation:
              "인터뷰에서는 답을 정해 두지 않은 열린 질문으로 경험을 묻고, 사용자가 말한 불편함을 근거로 컨셉을 정해요. 근거 없는 컨셉은 사용자에게 필요 없을 수 있어요.",
          },
          {
            template: "K",
            title: "손잡이 테스트",
            task: "손잡이 치수를 바꿔 가며 손 크기가 다른 세 사람이 모두 편한 손잡이를 찾아요.",
            cards: [
              {
                title: "인체 치수",
                body: "제품을 쓰는 사람의 몸 크기를 잰 자료예요. 이 체험의 손가락 너비와 길이는 한국인 손을 실제로 잰 조사 자료의 평균값이에요.",
              },
              {
                title: "큰 손과 작은 손",
                body: "여럿이 쓰는 제품은 평균인 한 사람만 보지 않고, 손이 큰 사람과 작은 사람이 모두 쓸 수 있는 치수 범위를 찾아요. 이 체험은 세 집단의 평균값으로 단순하게 해 봐요.",
              },
              {
                title: "이 체험의 규칙",
                body: "세 사람 모두 손가락 두 개를 넣어 잡는다고 봐요. 편함의 기준(여유 4mm 이상, 굵기 10mm 이상, 굵기는 셋째손가락 길이의 20% 이하)은 실제 인체공학 기준이 아니라 체험용으로 단순하게 정했어요.",
              },
            ],
            prompt: "슬라이더로 손잡이를 바꾼 뒤 '잡아 보기'를 누르면 세 사람이 차례로 컵을 잡아 봐요. 세 사람 모두 편한 손잡이를 찾아요.",
            params: [
              { id: "length", label: "손잡이 안쪽 길이", unit: "mm", min: 30, max: 70, step: 1, start: 36 },
              { id: "thickness", label: "손잡이 굵기", unit: "mm", min: 6, max: 24, step: 1, start: 16 },
            ],
            measures: [
              { id: "index", label: "둘째손가락(검지) 너비", unit: "mm" },
              { id: "middle", label: "셋째손가락(중지) 너비", unit: "mm" },
              { id: "middlelength", label: "셋째손가락(중지) 길이", unit: "mm" },
            ],
            // 손가락 너비는 손가락 아래 관절(가운데 마디) 너비다. 아이 자료는 두 관절 너비 중 넓은 쪽(FB22·FB32, 논문 본문으로 보아 아래 관절)이다.
            people: [
              {
                id: "adult",
                label: "어른",
                note: "20~30대 여성 평균",
                source: "Size Korea(2010) 3차원 측정 393명, 최은희·도월희(2013) 한국의류산업학회지 15(4) 표 4",
                values: { index: 16.5, middle: 16.0, middlelength: 79.7 },
              },
              {
                id: "child",
                label: "아이",
                note: "8세 남녀 평균",
                source: "제6차 Size Korea(2010) 3차원 측정, 전은경(2021) 한국의류학회지 45(6) 표 3, 남아·여아 평균",
                values: { index: 14.1, middle: 14.1, middlelength: 63.8 },
              },
              {
                id: "elder",
                label: "어르신",
                note: "60세 이상 여성 평균",
                source: "60세 이상 여성 349명 2차원 손 스캔(광주, 2012), 최은희·도월희(2013) 한국의류산업학회지 15(4) 표 5",
                values: { index: 22.6, middle: 21.2, middlelength: 75.5 },
              },
            ],
            checks: [
              {
                id: "fit",
                label: "손가락 넣기",
                terms: [{ param: "length", k: 1 }, { measure: "index", k: -1 }, { measure: "middle", k: -1 }],
                min: 4,
                low: "손가락 두 개가 꽉 껴요",
              },
              { id: "thin", label: "손가락 압력", terms: [{ param: "thickness", k: 1 }], min: 10, low: "손잡이가 가늘어 손가락이 아파요" },
              {
                id: "wrap",
                label: "감싸 쥐기",
                terms: [{ param: "thickness", k: 1 }, { measure: "middlelength", k: -0.2 }],
                max: 0,
                high: "손잡이가 굵어 손가락으로 감싸기 힘들어요",
              },
            ],
            limits: [
              {
                id: "cup",
                label: "컵에 붙이기",
                terms: [{ param: "length", k: 1 }, { param: "thickness", k: 2 }],
                max: 76,
                high: "손잡이가 컵에 붙일 수 있는 높이(76mm)보다 커요",
              },
            ],
            good: "편하게 잡혀요!",
            done: "세 사람 모두 편하게 잡았어요!",
            footnote: "어르신 자료는 광주 지역 60세 이상 여성을 2차원 손 스캐너로 잰 값이라, 3차원으로 잰 다른 두 자료보다 손가락 너비가 크게 나왔을 수 있어요.",
            explanation:
              "디자이너는 사람들의 몸 크기 자료로 제품 치수를 정해요. 이번에는 손가락이 가장 굵은 어르신이 구멍 크기의 최소값을, 손이 가장 작은 아이가 손잡이 굵기의 최대값을 정했어요.",
          },
        ],
      },
      // 편성표에서 UX디자인과 서비스디자인은 3학년 과목이다(공시 자료 이름도 같다).
      3: {
        status: "verified",
        subjects: [
          { name: "UX디자인", source: "공시" },
          { name: "서비스디자인", source: "공시" },
        ],
        parts: [
          {
            template: "L",
            title: "버튼 크기 실험",
            task: "크기와 거리가 다른 막대를 번갈아 눌러, 내 손으로 버튼 크기의 법칙을 찾아요.",
            cards: [
              {
                title: "피츠의 법칙",
                body: "목표를 누르는 데 걸리는 시간은 목표가 멀수록, 작을수록 길어져요. 1954년 심리학자 폴 피츠가 실험으로 밝혀서 피츠의 법칙이라고 불러요.",
              },
              {
                title: "누르기 어려움",
                body: "오늘날 많이 쓰는 식은 log₂(거리÷너비+1)로, 단위는 비트예요. 멀고 좁을수록 커지고, 이 값이 1 커질 때마다 걸리는 시간이 거의 일정한 만큼씩 늘어요.",
              },
              {
                title: "UX 디자인에서",
                body: "UX 디자이너는 자주 누르는 버튼을 크게 만들고, 손가락이나 커서가 있는 곳 가까이 둬요. 이 실험에서 그 까닭을 내 기록으로 확인해요.",
              },
            ],
            targets: [
              { width: 64, distance: 64 },
              { width: 44, distance: 132 },
              { width: 28, distance: 196 },
              { width: 18, distance: 270 },
            ],
            taps: 8,
            prompt:
              "색이 진한 막대를 누르면 반대편 막대가 진해져요. 번갈아 빠르고 정확하게 눌러요. 막대 크기와 거리가 네 번 바뀌어요.",
            effect: "대체로 작고 먼 막대일수록 오래 걸렸어요. 피츠의 법칙이 내 손에서도 나타났어요.",
            noEffect: "이번 기록에서는 작고 먼 막대가 더 오래 걸리지 않았어요. 중간에 쉬었다 누르면 그럴 수 있으니 다시 해 보세요.",
            footnote: "마우스나 손가락으로 해요. 키보드로 누르면 손을 옮기는 거리가 없어서 법칙이 잘 드러나지 않아요.",
            apply: {
              label: "결제 버튼 너비",
              prompt: "키오스크에서 손가락이 결제 버튼까지 이만큼 움직인다면, 버튼 너비에 따라 누르는 데 얼마나 걸릴까요?",
              distance: 200,
              min: 14,
              max: 100,
              start: 20,
            },
            explanation:
              "버튼까지의 거리와 버튼 너비로 누르는 시간을 예측할 수 있어요(피츠의 법칙). UX 디자이너는 자주 누르는 버튼을 크고 가깝게 둬서 빠르고 실수가 적게 쓰게 해요.",
          },
          {
            template: "C",
            title: "서비스 블루프린트",
            task: "카페에서 음료를 사는 과정을 고객·직원·시스템의 일로 나눠 블루프린트에 놓아요.",
            cards: [
              {
                title: "서비스 블루프린트",
                body: "서비스가 이뤄지는 과정을 한 장에 그린 지도예요. 고객이 하는 일과, 그 일을 받쳐 주는 직원·시스템의 일을 줄을 나눠 나란히 적어요.",
              },
              {
                title: "가시선",
                body: "고객 눈에 보이는 일과 보이지 않는 일 사이의 선이에요. 바로 위는 직원이 고객 앞에서 하는 일(프론트스테이지), 바로 아래는 고객이 못 보는 곳의 일(백스테이지)이에요.",
              },
              {
                title: "지원 프로세스",
                body: "고객을 맞는 직원이 아니라 다른 부서나 시스템이 하는 일이에요. 결제 시스템, 물류처럼 서비스를 뒤에서 받쳐 줘요.",
              },
            ],
            prompt: "카페에서 음료를 사는 과정의 한 장면이에요. 블루프린트의 어느 줄에 들어갈지 골라요.",
            slots: [
              {
                label: "들어갈 줄",
                options: [
                  { id: "customer", label: "고객 행동" },
                  { id: "front", label: "프론트스테이지" },
                  { id: "back", label: "백스테이지" },
                  { id: "support", label: "지원 프로세스" },
                ],
              },
            ],
            items: [
              {
                text: "손님이 메뉴판을 보고 마실 음료를 고른다.",
                answer: ["customer"],
                why: "고객이 직접 하는 일은 맨 위 고객 행동 줄에 적어요.",
              },
              {
                text: "계산대 직원이 손님과 마주 보고 주문을 받는다.",
                answer: ["front"],
                why: "직원이 고객 눈앞에서 하는 일이라 가시선 위, 프론트스테이지예요.",
              },
              {
                text: "카드 결제 시스템이 결제를 승인한다.",
                answer: ["support"],
                why: "매장 직원이 아니라 결제 시스템이 뒤에서 처리하는 일이라 지원 프로세스예요.",
              },
              {
                text: "주문을 받은 직원이 손님에게 보이지 않는 주방 안쪽으로 들어가 샌드위치를 데운다.",
                answer: ["back"],
                why: "손님을 맞는 직원이 하는 일이지만 고객에게 보이지 않아서 가시선 아래, 백스테이지예요.",
              },
              {
                text: "직원이 완성된 음료를 손님에게 건네준다.",
                answer: ["front"],
                why: "고객과 직접 마주하는 직원의 일이라 프론트스테이지예요.",
              },
              {
                text: "손님이 음료를 받아 자리에 앉는다.",
                answer: ["customer"],
                why: "고객이 직접 하는 일이라 고객 행동 줄이에요.",
              },
              {
                text: "음료를 만들던 직원이 우유가 떨어져, 손님이 들어올 수 없는 창고에서 우유를 꺼내 온다.",
                answer: ["back"],
                why: "손님 음료를 만드는 직원의 일이지만 고객 눈에 보이지 않는 곳에서 해서 백스테이지예요.",
              },
              {
                text: "본사 물류팀이 매장에 원두를 배송한다.",
                answer: ["support"],
                why: "고객을 맞는 직원이 아닌 다른 부서가 서비스를 받쳐 주는 일이라 지원 프로세스예요.",
              },
            ],
            noun: "장면",
            unit: "개",
            retry: "다시 생각해 봐요. 누가 하는 일인지, 고객 눈에 보이는지 따져 봐요.",
            explanation:
              "서비스 블루프린트는 고객이 보는 일과 그 뒤를 받쳐 주는 일을 줄로 나눠 보여 줘요. 서비스디자이너는 이 지도로 어디서 문제가 생기는지 찾아요.",
          },
        ],
      },
    },
  },
};

// 학년 자리 하나의 학과 전용 체험을 검사한다. 형식이 틀리면 null.
const SUBJECT_SOURCES = ["공시", "편성표"];
function cleanSubject(subject) {
  if (!subject || !text(subject.name, 40) || !SUBJECT_SOURCES.includes(subject.source)) return null;
  if (subject.alias !== undefined && (subject.source !== "편성표" || !text(subject.alias, 40) || subject.alias === subject.name)) return null;
  return { name: subject.name, source: subject.source, ...(subject.alias ? { alias: subject.alias } : {}) };
}
export function cleanStudio(entry) {
  if (!entry || typeof entry !== "object" || !["review", "verified"].includes(entry.status)) return null;
  const parts = Array.isArray(entry.parts) && entry.parts.length >= 1 && entry.parts.length <= 3 ? entry.parts.map(cleanExperience) : null;
  const subjects = Array.isArray(entry.subjects) && entry.subjects.length >= 1 && entry.subjects.length <= 3 ? entry.subjects.map(cleanSubject) : null;
  if (!parts || !parts.every(Boolean) || !subjects || !subjects.every(Boolean)) return null;
  if (new Set(subjects.map((subject) => subject.name)).size !== subjects.length) return null;
  return { status: entry.status, subjects, parts };
}

function cleanSource(source) {
  return source &&
    text(source.title, 100) &&
    /^https?:\/\//.test(source.url || "") &&
    Number.isInteger(source.year) &&
    source.year >= 2000 &&
    source.year <= 2100 &&
    /^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt || "")
    ? { title: source.title, url: source.url, year: source.year, checkedAt: source.checkedAt }
    : null;
}

// 검사한 데이터: { "학교|학과": { source, years: { 학년: studio | null } } }. 형식이 틀린 학년은 null이 되고 테스트에서 걸린다.
export const departmentData = Object.fromEntries(
  Object.entries(raw).map(([key, entry]) => [
    key,
    {
      source: cleanSource(entry.source),
      years: Object.fromEntries(Object.entries(entry.years || {}).map(([year, studio]) => [year, cleanStudio(studio)])),
    },
  ]),
);

// 그 학교·학과·학년의 공개된(verified) 학과 전용 체험과 학년을 확인한 편성표(source). 출처가 없거나 검토 전이면 null.
export function studioFor(school, course, year) {
  const entry = departmentData[`${school}|${course}`];
  const studio = entry?.source ? entry.years[year] : null;
  return studio?.status === "verified" ? { ...studio, source: entry.source } : null;
}

// 과목이 그 학과에서 그 학년 과목으로 확인되는지. curriculum은 공시 교과목, yearly는 서버가 보낸 편성표 학년(model.js의 cleanYears).
export function subjectConfirmed(subject, year, curriculum, yearly, source) {
  if (subject.source === "공시")
    return curriculum.includes(subject.name) && (!yearly || yearly.subjects[subject.name] === year);
  // 편성표 과목은 같은 편성표(주소·연도)에서 넣은 학년 자료로만 확인한다.
  if (!yearly || !source || yearly.source_url !== source.url || yearly.curriculum_year !== source.year) return false;
  if (subject.alias)
    return curriculum.includes(subject.alias) && yearly.subjects[subject.alias] === year && yearly.names?.[subject.alias] === subject.name;
  return yearly.extra?.[subject.name] === year;
}

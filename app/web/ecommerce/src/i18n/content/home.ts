/**
 * The storefront home page's own copy (hero slides, the benefit strip, sorting, the 3D
 * collection) in Chinese, Korean and Japanese, keyed by the English text exactly as it is
 * written in pages/Home.tsx, components/HeroSlider.tsx, components/JewelryCollection.tsx and
 * components/StoreService.tsx. Added to each language's content dictionary when it is loaded.
 */
type Three = { zh: string; ko: string; ja: string };

const HOME: Record<string, Three> = {
  'Layered white gold necklaces and rings styled with a white blouse': { zh: '白色衬衫搭配叠戴的白色黄金项链与戒指', ko: '흰 블라우스에 레이어드한 화이트 골드 목걸이와 반지', ja: '白いブラウスに重ねづけしたホワイトゴールドのネックレスとリング' },
  'Quiet light, made to be worn.': { zh: '静谧光芒，为佩戴而生。', ko: '고요한 빛, 매일 착용하기 위해.', ja: '静かな輝きを、身にまとうために。' },
  'Rings, necklaces, bracelets and earrings in white gold. Fine lines, made to stay with you every day.': { zh: '白色黄金戒指、项链、手链与耳环。线条纤细，陪伴您的每一天。', ko: '화이트 골드 반지, 목걸이, 팔찌, 귀걸이. 섬세한 라인으로 매일 함께합니다.', ja: 'ホワイトゴールドのリング、ネックレス、ブレスレット、ピアス。繊細なラインで、毎日に寄り添います。' },
  'Explore the collection': { zh: '探索系列', ko: '컬렉션 둘러보기', ja: 'コレクションを見る' },
  'Polished white gold bypass ring resting by the cheek': { zh: '贴近脸颊的抛光白色黄金交错戒指', ko: '뺨 가까이에 놓인 폴리시드 화이트 골드 바이패스 링', ja: '頬に添えた、磨き上げたホワイトゴールドのバイパスリング' },
  'A turn of light, close at hand.': { zh: '指尖流转的一抹光。', ko: '손끝에서 빛나는 작은 광채.', ja: '指先に、ひとすじの光を。' },
  'Bypass, solitaire and pavé bands, polished to catch the light with every gesture.': { zh: '交错、单石与密镶戒指，精心抛光，一举一动皆映光彩。', ko: '바이패스, 솔리테어, 파베 밴드. 움직일 때마다 빛을 담도록 연마했습니다.', ja: 'バイパス、ソリテール、パヴェのリング。しぐさのたびに光をとらえるよう磨き上げました。' },
  'Shop rings': { zh: '选购戒指', ko: '반지 보기', ja: 'リングを見る' },
  'Seven-diamond station necklace over a white collar': { zh: '白色衣领上的七钻间镶项链', ko: '흰 칼라 위의 7 다이아몬드 스테이션 목걸이', ja: '白い襟元に映える、7石ダイヤのステーションネックレス' },
  'Fine chains, drawn along the collarbone.': { zh: '纤细链条，沿锁骨轻轻勾勒。', ko: '쇄골을 따라 흐르는 가는 체인.', ja: '鎖骨に沿う、繊細なチェーン。' },
  'Stations, pendants and layered drops, light enough to wear every day.': { zh: '间镶、吊坠与叠戴款式，轻盈得适合每日佩戴。', ko: '스테이션, 펜던트, 레이어드 드롭. 매일 착용해도 가볍습니다.', ja: 'ステーション、ペンダント、レイヤードドロップ。毎日着けられる軽やかさです。' },
  'Shop necklaces': { zh: '选购项链', ko: '목걸이 보기', ja: 'ネックレスを見る' },
  'Pavé white gold bangle on a relaxed wrist': { zh: '手腕上的密镶白色黄金手镯', ko: '편안한 손목 위의 파베 화이트 골드 뱅글', ja: '手首に添えた、パヴェのホワイトゴールドバングル' },
  'Pavé that moves with the wrist.': { zh: '随手腕而动的密镶光彩。', ko: '손목의 움직임을 따라 빛나는 파베.', ja: '手首の動きに寄り添うパヴェ。' },
  'Bangles, cuffs and tennis bracelets with a quiet shine from morning to evening.': { zh: '手镯、开口镯与网球手链，从清晨到夜晚，光泽静谧。', ko: '뱅글, 커프, 테니스 팔찌. 아침부터 저녁까지 은은하게 빛납니다.', ja: 'バングル、カフ、テニスブレスレット。朝から夜まで、静かに輝きます。' },
  'Shop bracelets': { zh: '选购手链', ko: '팔찌 보기', ja: 'ブレスレットを見る' },
  'Delicate white gold flower earring in profile': { zh: '侧面所见的精致白色黄金花朵耳环', ko: '옆모습에 보이는 섬세한 화이트 골드 플라워 귀걸이', ja: '横顔に映える、繊細なホワイトゴールドのフラワーピアス' },
  'Light, framed at the ear.': { zh: '耳畔的一点微光。', ko: '귓가에 담은 빛.', ja: '耳もとに、小さな光を。' },
  'Studs, hoops and climbers, petite in scale and considered in every stone.': { zh: '耳钉、耳圈与攀耳式耳环，尺寸小巧，每一颗宝石都经过悉心挑选。', ko: '스터드, 후프, 클라이머. 작고 섬세하며 스톤 하나하나를 신중히 골랐습니다.', ja: 'スタッド、フープ、クライマー。小ぶりで、ひと粒ひと粒にこだわりました。' },
  'Shop earrings': { zh: '选购耳环', ko: '귀걸이 보기', ja: 'ピアスを見る' },
  'Explore Aurelle rings, bracelets, necklaces and earrings in white gold.': { zh: '探索 Aurelle 白色黄金戒指、手链、项链与耳环。', ko: 'Aurelle의 화이트 골드 반지, 팔찌, 목걸이, 귀걸이를 만나보세요.', ja: 'Aurelleのホワイトゴールドのリング、ブレスレット、ネックレス、ピアスをご覧ください。' },
  'Aurelle services': { zh: 'Aurelle 服务', ko: 'Aurelle 서비스', ja: 'Aurelleのサービス' },
  'White gold collections': { zh: '白色黄金系列', ko: '화이트 골드 컬렉션', ja: 'ホワイトゴールドコレクション' },
  'Ready-stock selection': { zh: '现货精选', ko: '즉시 배송 가능 상품', ja: '在庫ありのセレクション' },
  'Prices in rupiah': { zh: '价格以印尼盾显示', ko: '가격은 루피아로 표시', ja: '価格はルピア表示' },
  'Sort': { zh: '排序', ko: '정렬', ja: '並べ替え' },
  'Featured': { zh: '精选推荐', ko: '추천순', ja: 'おすすめ' },
  'Price, low to high': { zh: '价格从低到高', ko: '가격 낮은순', ja: '価格の安い順' },
  'Price, high to low': { zh: '价格从高到低', ko: '가격 높은순', ja: '価格の高い順' },
  '{n} pieces': { zh: '{n} 件', ko: '{n}개', ja: '{n}点' },
  'Explore the full catalog': { zh: '浏览完整目录', ko: '전체 카탈로그 보기', ja: 'すべての商品を見る' },
  'Collection highlights': { zh: '系列精选', ko: '컬렉션 하이라이트', ja: 'コレクションのハイライト' },
  'Show photo {n} of {count}': { zh: '显示第 {n} 张图片，共 {count} 张', ko: '사진 {count}장 중 {n}번째 보기', ja: '写真 {n}／{count} を表示' },
  'The collection, from every angle': { zh: '从每个角度欣赏系列', ko: '모든 각도에서 보는 컬렉션', ja: 'あらゆる角度から見るコレクション' },
  '7 rings · 7 bracelets · 7 necklaces · 8 earrings': { zh: '7 款戒指 · 7 款手链 · 7 款项链 · 8 款耳环', ko: '반지 7 · 팔찌 7 · 목걸이 7 · 귀걸이 8', ja: 'リング7点 · ブレスレット7点 · ネックレス7点 · ピアス8点' },
  'Aurelle interactive 3D jewelry collection': { zh: 'Aurelle 互动式 3D 珠宝系列', ko: 'Aurelle 인터랙티브 3D 주얼리 컬렉션', ja: 'Aurelle インタラクティブ3Dジュエリーコレクション' },
  'EXPLORE 29 PIECES IN 3D': { zh: '以 3D 探索 29 款作品', ko: '29개 작품을 3D로 보기', ja: '29点を3Dで見る' },
  'Choose a category and model · Drag to rotate · Scroll / pinch to zoom': { zh: '选择类别与款式 · 拖动旋转 · 滚动 / 双指缩放', ko: '카테고리와 모델 선택 · 드래그하여 회전 · 스크롤 / 핀치로 확대', ja: 'カテゴリーとモデルを選択 · ドラッグで回転 · スクロール／ピンチで拡大' },
  'Aurelle promises': { zh: 'Aurelle 承诺', ko: 'Aurelle의 약속', ja: 'Aurelleのお約束' },
};

/** The home page's entries for one language, in the shape of a content dictionary. */
export function homeContent(code: keyof Three): Record<string, string> {
  return Object.fromEntries(Object.entries(HOME).map(([english, text]) => [english, text[code]]));
}

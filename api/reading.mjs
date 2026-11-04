// KUAAA 천체 타로 · 풀이 서버 (Vercel Function)
//
// 사이트에서 '어떤 펼침에 몇 번 카드가 정·역방향으로 나왔는지'만 받아서,
// 이 서버 안에서 풀이 요청 문장을 만들고 Claude API(Haiku 5.5)를 불러 풀이를 돌려줘요.
// vercel.json에서 실행 지역을 미국 워싱턴 D.C.(iad1)로 고정해 두었어요.
//
// Vercel 프로젝트 Settings > Environment Variables
//   ANTHROPIC_API_KEY       (필수) Claude Console에서 만든 API 키
//   ALLOWED_ORIGIN          (선택) 사이트 주소를 더 허용하려면 쉼표로 구분해 넣어요
//                                  https://doodoo1014.github.io 와 이 Vercel 주소는 이미 허용돼 있어요
//   ANTHROPIC_WORKSPACE_ID  (선택) 키를 워크스페이스에 묶지 않았을 때만 필요해요

const MODEL = 'claude-haiku-5-5';
const MAX_TOKENS = 1600;            // 가장 긴 파이브 카드 풀이(450~650자)에도 넉넉한 상한
const PER_IP_LIMIT = 20;            // 같은 IP에서 5분에 20번까지 (학교 와이파이처럼 여럿이 한 IP를 써도 버틸 정도)
const DEFAULT_ORIGINS = ['https://doodoo1014.github.io'];
const WINDOW_MS = 5 * 60 * 1000;

const CARDS = [
  {r:'0', en:'THE FOOL', ko:'바보', obj:'바람개비 은하', cat:'M101', con:'큰곰자리', photo:true,
   up:['새 출발','자유','모험'], upT:'계획보다 설렘이 앞서는 시작의 순간이에요. 결과를 다 알 수 없어도 첫발을 내딛을 용기가 있다면, 길은 걸으면서 열려요.',
   rv:['무모함','망설임','준비 부족'], rvT:'들뜬 마음에 발밑을 못 보고 있거나, 반대로 두려움 때문에 출발을 미루고 있을 수 있어요. 가볍게 가되 눈은 크게 뜨세요.',
   sky:'바람 부는 대로 가볍게 도는 바람개비처럼, 근심 없이 길을 나서는 바보예요. 바람개비 은하는 나선팔을 정면으로 활짝 펼친 은하예요.'},
  {r:'I', en:'THE MAGICIAN', ko:'마법사', obj:'마법사 성운', cat:'NGC 7380', con:'케페우스자리', photo:true,
   up:['의지','재능','실행'], upT:'필요한 도구는 이미 손 안에 있어요. 생각을 현실로 옮길 때예요. 집중해서 시작하면 원하는 것을 만들어 낼 수 있어요.',
   rv:['재능 낭비','속임수','산만함'], rvT:'가진 힘을 엉뚱한 데 쓰고 있거나, 말만 앞서고 실행이 따르지 않을 수 있어요. 그럴듯한 말일수록 한 번 더 확인하세요.',
   sky:'이름부터 마법사예요. 성운의 모양이 뾰족한 모자를 쓴 마법사의 옆모습을 닮아서 붙은 이름이에요.'},
  {r:'II', en:'THE HIGH PRIESTESS', ko:'여사제', obj:'베일 성운', cat:'NGC 6960 · 6992', con:'백조자리', photo:true,
   up:['직관','비밀','내면의 목소리'], upT:'아직 드러나지 않은 것이 있어요. 서두르기보다 조용히 지켜보며 마음속 목소리에 귀 기울이면 답이 보여요.',
   rv:['감춰진 의도','직관 외면','겉도는 마음'], rvT:'느낌으로는 알고 있는데 외면하고 있을 수 있어요. 숨은 사정이 있으니 겉으로 보이는 것만 믿지 마세요.',
   sky:'여사제 뒤에는 휘장(베일)이 드리워져 있어요. 베일 성운은 1~2만 년 전 터진 별의 잔해가 얇은 천처럼 하늘에 펼쳐진 모습이에요.'},
  {r:'III', en:'THE EMPRESS', ko:'여황제', obj:'안드로메다 은하', cat:'M31', con:'안드로메다자리', photo:true,
   up:['풍요','모성','아름다움'], upT:'돌보고 가꾼 것이 무르익는 때예요. 사랑도, 창작도, 관계도 넉넉하게 자라나요. 나를 아끼는 일도 잊지 마세요.',
   rv:['과잉보호','의존','메마름'], rvT:'남을 챙기느라 정작 내가 지쳐 있거나, 너무 감싸서 상대가 자랄 틈이 없을 수 있어요. 먼저 스스로를 채우세요.',
   sky:'우리 은하 이웃 중 가장 큰 은하로, 작은 위성 은하 M32와 M110을 곁에 거느리고 있어요. 신화 속 안드로메다 공주는 왕비가 되어 여러 자녀를 낳았어요.'},
  {r:'IV', en:'THE EMPEROR', ko:'황제', obj:'북아메리카 성운', cat:'NGC 7000', con:'백조자리', photo:true,
   up:['질서','책임','리더십'], upT:'원칙과 계획이 힘을 발휘할 때예요. 기준을 세우고 책임지는 자리에 서면 주변도 안정을 찾아요.',
   rv:['고집','통제','권위주의'], rvT:'지나친 통제나 고집이 관계를 굳게 만들고 있을 수 있어요. 규칙보다 사람을 먼저 보세요.',
   sky:'대륙 하나를 다스리는 황제예요. 황제 뒤에 솟은 바위산처럼, 이 성운에는 ‘백조자리 벽’이라 불리는 성벽 같은 구조가 솟아 있어요.'},
  {r:'V', en:'THE HIEROPHANT', ko:'교황', obj:'부자 은하', cat:'M51', con:'사냥개자리', photo:true,
   up:['전통','가르침','신뢰'], upT:'검증된 방법과 좋은 스승의 조언이 도움이 돼요. 공동체 안에서 배우고 나누는 것이 길이에요.',
   rv:['고정관념','형식주의','반항'], rvT:'익숙한 틀이 오히려 발목을 잡고 있을 수 있어요. 남들이 다 그렇게 한다는 이유만으로 따르고 있진 않은지 돌아보세요.',
   sky:'교황(Pope)은 ‘아버지(papa)’에서 온 말이에요. 큰 은하에 작은 은하가 이어진 ‘아버지와 아들’처럼, 교황은 가르침이 세대를 건너 이어지는 카드예요.'},
  {r:'VI', en:'THE LOVERS', ko:'연인', obj:'하트 성운', cat:'IC 1805', con:'카시오페이아자리', photo:true,
   up:['사랑','조화','진심의 선택'], upT:'마음이 통하는 관계, 그리고 진심으로 고르는 선택의 카드예요. 머리와 마음이 같은 쪽을 가리킨다면 그 길이 맞아요.',
   rv:['엇갈림','갈등','미루는 선택'], rvT:'마음과 상황이 엇갈리거나, 선택을 미루다 양쪽을 다 놓치고 있을 수 있어요. 무엇을 진짜 원하는지부터 정하세요.',
   sky:'이름 그대로 하트 모양 성운이에요. 바로 옆의 태아 성운(영혼 성운)과 함께 ‘하트 앤 소울’이라는 한 쌍으로 불려요.'},
  {r:'VII', en:'THE CHARIOT', ko:'전차', obj:'사자자리 세 쌍둥이', cat:'M65 · M66 · NGC 3628', con:'사자자리', photo:true,
   up:['의지','전진','승리'], upT:'서로 다른 힘을 한 방향으로 모으면 앞으로 나아갈 수 있어요. 목표를 정했다면 흔들리지 말고 밀고 나가세요.',
   rv:['방향 상실','조급함','통제 불능'], rvT:'의욕은 넘치는데 방향이 흩어져 있거나, 서두르다 균형을 잃고 있을 수 있어요. 고삐부터 다시 쥐세요.',
   sky:'전차를 끄는 두 스핑크스는 사자의 몸을 하고 있어요. 사자자리에서 세 은하가 나란히 달리는 모습이 전차 행렬 같아요.'},
  {r:'VIII', en:'STRENGTH', ko:'힘', obj:'아령 성운', cat:'M27', con:'여우자리', photo:true,
   up:['용기','인내','부드러운 힘'], upT:'진짜 힘은 억누르는 데서가 아니라 다독이는 데서 나와요. 차분한 인내로 어려움을 길들일 수 있어요.',
   rv:['자신감 부족','감정 폭발','무력감'], rvT:'스스로를 믿지 못하거나, 참던 감정이 터져 나올 수 있어요. 나에게도 다정하게 대해 주세요.',
   sky:'아령은 힘의 상징이에요. 아령 성운은 태양 같은 별이 삶의 마지막에 바깥층을 내보내며 만든 행성상 성운이에요.'},
  {r:'IX', en:'THE HERMIT', ko:'은둔자', obj:'석호 성운', cat:'M8', con:'궁수자리', photo:true,
   up:['성찰','고독','지혜'], upT:'잠시 소란에서 물러나 혼자 생각할 시간이 필요해요. 스스로 밝힌 작은 등불이 다음 길을 보여 줘요.',
   rv:['고립','외로움','회피'], rvT:'혼자만의 시간이 길어져 고립이 되었거나, 생각만 하고 나서지 못하고 있을 수 있어요. 먼저 손을 내밀어 보세요.',
   sky:'석호는 모래톱에 막혀 바다와 떨어진 고요한 물이에요. 성운 한가운데 ‘모래시계’라 불리는 밝은 부분은, 옛 타로에서 은둔자가 들던 모래시계와도 겹쳐요.'},
  {r:'X', en:'WHEEL OF FORTUNE', ko:'운명의 수레바퀴', obj:'고리 성운', cat:'M57', con:'거문고자리', photo:true,
   up:['전환점','순환','행운'], upT:'흐름이 바뀌는 때예요. 돌고 도는 바퀴처럼 좋은 기회가 다가오고 있으니, 변화를 타고 넘어가세요.',
   rv:['불운','정체','거스르는 흐름'], rvT:'뜻대로 되지 않는 시기일 수 있지만 바퀴는 멈추지 않아요. 억지로 거스르기보다 다음 차례를 준비하세요.',
   sky:'바퀴 모양 그대로예요. 죽어 가는 별이 내보낸 물질은 다음 세대 별의 재료가 돼요. 별의 삶도 수레바퀴처럼 돌고 돌아요.'},
  {r:'XI', en:'JUSTICE', ko:'정의', obj:'이중성단', cat:'NGC 869 · NGC 884', con:'페르세우스자리', photo:true,
   up:['공정','균형','책임'], upT:'뿌린 대로 거두는 때예요. 사실을 공정하게 따져 보고 내 선택에 책임을 지면 올바른 결과가 따라와요.',
   rv:['불공정','책임 회피','치우친 판단'], rvT:'한쪽으로 기운 판단을 하고 있거나, 책임을 남에게 돌리고 있을 수 있어요. 저울을 다시 맞춰 보세요.',
   sky:'정의의 여신은 한 손에 칼, 다른 손에 저울을 들어요. 이중성단은 별자리 그림에서 영웅 페르세우스가 든 칼의 보석 손잡이 자리에 있고, 거리도 나이도 비슷한 두 성단이 저울 양쪽처럼 나란히 균형을 이뤄요.'},
  {r:'XII', en:'THE HANGED MAN', ko:'매달린 사람', obj:'태아 성운', cat:'IC 1848', con:'카시오페이아자리', photo:true,
   up:['멈춤','기다림','새로운 관점'], upT:'지금은 억지로 움직이기보다 멈춰서 다르게 바라볼 때예요. 기다림 끝에 새로운 이해가 찾아와요.',
   rv:['지연','헛된 희생','버티기'], rvT:'의미 없는 기다림이나 희생을 이어 가고 있을 수 있어요. 이제는 놓아 줄 때인지 생각해 보세요.',
   sky:'뱃속의 태아는 머리를 아래로 둔 채 세상에 나올 때를 기다려요. 거꾸로 매달려 깨달음을 기다리는 매달린 사람과 닮았어요. 영어 이름은 ‘영혼 성운’이에요.'},
  {r:'XIII', en:'DEATH', ko:'죽음', obj:'말머리 성운', cat:'B33 · NGC 2024', con:'오리온자리', photo:true,
   up:['끝과 시작','변화','정리'], upT:'하나의 장이 끝나고 다음 장이 열려요. 낡은 것을 보내야 새것이 들어올 자리가 생겨요. 두려워할 끝이 아니에요.',
   rv:['변화 거부','미련','정체'], rvT:'이미 끝난 것을 붙잡고 있어서 다음으로 넘어가지 못하고 있을 수 있어요. 정리할 것을 정리하세요.',
   sky:'죽음 카드의 기사는 말을 타고 와요. 붉은 성운 앞에 떠오른 검은 말머리가 바로 그 말이에요. 옆의 불꽃 성운도 한 장에 담겼어요.'},
  {r:'XIV', en:'TEMPERANCE', ko:'절제', obj:'삼렬 성운', cat:'M20', con:'궁수자리', photo:true,
   up:['조화','균형','인내'], upT:'서로 다른 것을 알맞게 섞을 때 가장 좋은 결과가 나와요. 서두르지 말고 천천히 균형을 맞춰 가세요.',
   rv:['불균형','지나침','조급함'], rvT:'한쪽으로 치우쳤거나 너무 많이, 너무 빨리 하려 하고 있을 수 있어요. 덜어 내는 것부터 시작하세요.',
   sky:'붉은 발광 성운과 푸른 반사 성운이 한 화면에서 어우러져요. 두 잔 사이로 물을 섞어 붓는 천사처럼요. 타로의 점성술 대응에서 절제는 궁수자리인데, 삼렬 성운도 궁수자리에 있어요.'},
  {r:'XV', en:'THE DEVIL', ko:'악마', obj:'불꽃별 성운', cat:'IC 405 · IC 410', con:'마차부자리', photo:true,
   up:['집착','유혹','속박'], upT:'벗어나고 싶은데 벗어나지 못하는 무언가가 있어요. 사슬은 생각보다 느슨해요. 무엇에 묶여 있는지 알아차리는 것이 시작이에요.',
   rv:['해방','깨달음','끊어 냄'], rvT:'오래 붙잡혀 있던 습관이나 관계에서 벗어날 힘이 생기고 있어요. 사슬을 풀 때예요.',
   sky:'이 성운을 밝히는 별은 약 250만 년 전 고향인 오리온자리에서 튕겨 나와 떠도는 별이에요. 하늘에서 쫓겨나 불을 든 별, 타락천사 루시퍼처럼요. 아래쪽은 올챙이 성운이에요.'},
  {r:'XVI', en:'THE TOWER', ko:'탑', obj:'독수리 성운', cat:'M16', con:'뱀자리', photo:true,
   up:['붕괴','충격','깨어남'], upT:'갑작스러운 변화가 쌓아 온 것을 흔들어요. 무너지는 것은 처음부터 단단하지 않았던 것이에요. 그 자리에서 진짜가 드러나요.',
   rv:['피한 위기','두려움','늦춰진 변화'], rvT:'무너질 것을 억지로 버티고 있거나, 큰 충격은 피했지만 근본 문제가 남아 있을 수 있어요.',
   sky:'성운 한가운데 ‘창조의 기둥’이 탑처럼 솟아 있어요. 이 기둥은 주변 뜨거운 별빛에 조금씩 깎여 무너지고 있어요.'},
  {r:'XVII', en:'THE STAR', ko:'별', obj:'플레이아데스 성단', cat:'M45', con:'황소자리', photo:true,
   up:['희망','치유','영감'], upT:'힘든 시간이 지나고 마음이 회복돼요. 맑은 마음으로 바라는 것을 그려 보세요. 희망이 길잡이가 되어 줄 거예요.',
   rv:['실망','의욕 상실','불신'], rvT:'기대가 어긋나 지쳐 있을 수 있어요. 작은 빛부터 다시 찾아보세요. 별은 구름 뒤에서도 떠 있어요.',
   sky:'별 카드에는 큰 별 하나와 작은 별 일곱 개가 그려져 있어요. 우리말로는 좀생이별, 서양에서는 ‘일곱 자매’라 부르는 별무리예요.'},
  {r:'XVIII', en:'THE MOON', ko:'달', obj:'달', cat:'실제 달 사진', con:'지구의 위성', photo:true,
   up:['불안','환상','무의식'], upT:'모든 것이 또렷하지 않은 밤길이에요. 막연한 불안이 커 보일 수 있지만, 보이는 것이 전부가 아니에요. 직감을 믿되 확인하세요.',
   rv:['혼란 해소','진실','두려움 극복'], rvT:'흐릿하던 상황이 걷히고 진실이 드러나기 시작해요. 괜한 걱정이었다는 걸 알게 될 수도 있어요.',
   sky:'22장 중 유일하게 진짜 달을 담은 카드예요. 달은 스스로 빛나지 않고 햇빛을 되비춰 빛나요. 밝아 보여도 제 빛이 아니라는 점이, 보이는 것과 실체가 다르다는 달 카드의 이야기 그대로예요.'},
  {r:'XIX', en:'THE SUN', ko:'태양', obj:'오리온 성운', cat:'M42', con:'오리온자리', photo:true,
   up:['성공','기쁨','활력'], upT:'모든 것이 환하게 드러나고 잘 풀리는 때예요. 자신감을 갖고 즐기세요. 기쁨은 나눌수록 커져요.',
   rv:['들뜬 기대','잠깐의 침체','과신'], rvT:'좋은 기운은 그대로지만 잠시 구름이 꼈을 뿐이에요. 지나친 낙관만 조심하면 곧 다시 밝아져요.',
   sky:'맨눈으로도 보이는 가장 밝은 성운이에요. 태양보다 수십 배 무거운 젊은 별들이 성운 전체를 환하게 밝히는, 별이 태어나는 요람이에요.'},
  {r:'XX', en:'JUDGEMENT', ko:'심판', obj:'사드르 주변', cat:'IC 1318', con:'백조자리', photo:true,
   up:['부름','부활','결단'], upT:'지난 일을 돌아보고 새롭게 일어설 때예요. 마음속 부름에 응답하면 다음 단계로 나아갈 수 있어요.',
   rv:['자기 비판','망설임','지난 일에 매임'], rvT:'과거의 실수를 너무 오래 곱씹고 있거나, 중요한 결정을 미루고 있을 수 있어요. 스스로를 용서하세요.',
   sky:'사드르는 백조자리 ‘북십자’의 한가운데 별이에요. 십자가 깃발을 단 나팔을 부는, 날개 달린 천사가 그려진 심판 카드와 겹쳐요.'},
  {r:'XXI', en:'THE WORLD', ko:'세계', obj:'장미 성운', cat:'NGC 2237', con:'외뿔소자리', photo:true,
   up:['완성','성취','통합'], upT:'한 바퀴의 여정이 아름답게 완성돼요. 이룬 것을 축하하고, 다음 여정을 위해 마음을 열어 두세요.',
   rv:['미완성','마무리 부족','지연'], rvT:'거의 다 왔지만 마지막 한 조각이 남아 있어요. 끝맺음을 미루지 말고 마무리하세요.',
   sky:'둥근 장미 모양 성운이 세계 카드 속 인물을 감싼 월계관을 닮았어요. 한가운데 젊은 별무리가 안쪽을 비워 둥근 꽃 모양을 만들었어요.'}
];
const L3 = '2~3문단, 모두 합쳐 300~450자';
// 사이트(index.html)의 SPREADS와 키·장수가 같아야 해요. 궁합의 {A} {B}는 이름으로 바뀌어요.
const SPREADS = {
  one:    {name:'원 카드', len:'2문단, 모두 합쳐 200~300자',
           pos:[{t:'메시지', d:'지금 마음에 둘 이야기'}]},
  three:  {name:'쓰리 카드', len:L3, framed:true,   // 자리 틀은 질문을 보고 FRAMES에서 골라요
           pos:[{t:'과거', d:'지금에 이르게 한 흐름'},{t:'현재', d:'지금 마주한 상황'},{t:'미래', d:'이대로 갈 때의 방향'}]},
  five:   {name:'파이브 카드', len:'3~4문단, 모두 합쳐 450~650자',
           guide:'과거와 원인에서 시작해 현재, 미래, 가능성 순서로 이어 써요.',
           pos:[{t:'현재', d:'지금 마주한 상황'},{t:'과거', d:'지금에 이르게 한 흐름'},{t:'미래', d:'이대로 갈 때의 방향'},{t:'원인', d:'문제의 뿌리'},{t:'가능성', d:'가장 좋게 풀릴 때의 모습'}]},
  compat: {name:'궁합', len:L3, noTopic:true,
           guide:'두 사람이 서로를 떠올리며 한 장씩 고른 궁합 풀이예요. 두 사람을 이름으로 부르며, 각자 상대에게 품은 마음, 두 마음이 어떻게 만나는지, 둘이 함께 해 볼 일 하나를 써요. 점수를 매기거나 헤어짐·결혼 같은 결말을 단정하지 않아요.',
           noQ:'질문 없음. 두 사람의 지금 마음과 어울림을 봐 주세요',
           pos:[{t:'{A}의 마음', d:'{A이} {B를} 떠올리며 고른 것'},{t:'{B}의 마음', d:'{B이} {A를} 떠올리며 고른 것'}]}
};
// 쓰리 카드의 자리 틀. 질문을 보고 서버가 하나를 골라요(사이트에는 자리 이름을 띄우지 않아요).
const FRAMES = {
  ppf:  {about:'일이나 상황이 앞으로 어떻게 흘러갈지 묻는 질문, 또는 어디에도 딱 맞지 않는 질문',
         pos:[{t:'과거', d:'지금에 이르게 한 흐름'},{t:'현재', d:'지금 마주한 상황'},{t:'미래', d:'이대로 갈 때의 방향'}]},
  sao:  {about:'지금 겪는 문제나 고민을 어떻게 풀지, 무엇이 가로막고 있는지 묻는 질문',
         pos:[{t:'상황', d:'지금 놓인 자리'},{t:'장애', d:'앞을 가로막는 것'},{t:'조언', d:'풀어 갈 실마리'}]},
  rel:  {about:'특정한 상대와의 관계나 그 사람의 마음을 묻는 질문',
         guide:"'나'는 질문한 사람, '상대'는 질문 속 그 사람이에요.",
         pos:[{t:'나', d:'이 관계 속 나의 마음'},{t:'상대', d:'상대의 마음'},{t:'관계', d:'둘 사이의 흐름'}]},
  fork: {about:'두 가지 선택지 가운데 무엇을 고를지 묻는 질문',
         guide:'질문 속 두 선택지를 첫 번째 길과 두 번째 길로 보고 각각 풀어요. 어느 쪽이 더 나아 보이는지 말할 수는 있지만, 결정은 질문한 사람에게 맡겨요.',
         pos:[{t:'선택 A', d:'첫 번째 길을 고르면'},{t:'선택 B', d:'두 번째 길을 고르면'},{t:'조언', d:'고르기 전에 기억할 것'}]}
};
const FRAME_SYSTEM = `타로 쓰리 카드 리딩에서, 질문에 가장 맞는 자리 배열을 고르는 일을 해요. 아래 기호 가운데 하나만 답하고, 다른 말은 쓰지 않아요.
${Object.entries(FRAMES).map(([k, f]) => `${k}: ${f.about}`).join('\n')}`;

// 운세 주제. 사이트의 TOPICS와 키가 같아야 해요.
const TOPICS = {
  total:  {name:'총운',       d:'생활 전반의 흐름'},
  love:   {name:'연애운',     d:'사랑과 연애, 마음이 가는 사람과의 관계'},
  study:  {name:'학업운',     d:'공부, 시험, 연구와 배움'},
  career: {name:'진로운',     d:'진로와 일, 앞으로 나아갈 방향'},
  money:  {name:'금전운',     d:'돈의 흐름과 돈을 대하는 마음. 투자나 큰 지출을 하라 말라 정해 주지는 않아요'},
  people: {name:'인간관계운', d:'친구, 동료, 가족과의 관계'},
  custom: {name:'', d:''}   // 관람객이 직접 적은 주제(topicText)
};
function topicOf(v) {
  return v.topic === 'custom' ? { name: v.topicText, d: '관람객이 직접 적은 주제' } : TOPICS[v.topic];
}

// 받침에 맞춰 조사 붙이기: josa('민지','을','를') → '민지를'
function josa(word, withFinal, noFinal) {
  const ch = word.charCodeAt(word.length - 1);
  if (ch >= 0xAC00 && ch <= 0xD7A3) return word + ((ch - 0xAC00) % 28 ? withFinal : noFinal);
  return `${word}${withFinal}(${noFinal})`;
}
function fillNames(s, [A, B]) {
  return s.replace(/\{A\}/g, A).replace(/\{B\}/g, B)
          .replace(/\{A를\}/g, josa(A, '을', '를')).replace(/\{B를\}/g, josa(B, '을', '를'))
          .replace(/\{A이\}/g, josa(A, '이', '가')).replace(/\{B이\}/g, josa(B, '이', '가'));
}

const SYSTEM = `당신은 타로 리더예요. 질문한 사람이 뽑은 카드의 뜻을 바탕으로, 그 사람의 상황에 대한 해석만 써요.

절대 쓰지 않는 것:
- 어떤 자리에 무엇이 나왔는지 알려 주는 말 (예: "과거의 자리에는 ○○가 놓였어요", "첫 번째 카드는")
- '카드', '자리', '정방향', '역방향'이라는 낱말과 카드 이름
- 카드 그림이나 사진, 그 속 천체(성운, 은하, 성단, 달)를 끌어온 비유나 설명

쓰는 방법:
- 받은 흐름(예: 그동안 → 지금 → 앞으로, 두 사람의 마음)을 "그동안", "지금은", "앞으로는" 같은 말로 자연스럽게 녹여, 하나의 이야기로 이어 써요.
- 요청에 '풀이 방식'이 있으면 그대로 따라요.
- 요청의 '주제'(연애운, 학업운, 또는 관람객이 직접 적은 주제)에 맞춰 풀어요. 질문이 있으면 질문이 먼저예요. 질문에 직접 답하고, 질문에 나온 상황을 구체적으로 짚어요.
- 다른 사람의 마음은 단정하지 말고 '~일 수 있어요'처럼 조심스럽게 써요.
- 분량은 요청의 '분량'을 지켜요. 마지막 문장은 지금 할 수 있는 일 하나로 끝내요.
- 다정한 존댓말(~해요). 단정적인 예언, 법률 판단, 투자·대출·큰 지출 같은 구체적인 돈 결정은 하지 않아요.
- 건강에 관한 주제나 질문이면 쉼, 생활 리듬, 몸과 마음을 돌보는 흐름으로만 풀어요. 병이나 증상, 치료, 약에 대한 판단은 하지 않고, 걱정되는 증상이 있다면 병원에서 확인해 보라고 부드럽게 덧붙여요.
- 질문이 점과 관계없거나 위험한 내용이면, 풀이 대신 한두 문장으로 부드럽게 다른 질문을 권해요.
- 마크다운 기호 없이 문단으로만 써요.

말투 예시(내용은 따라 하지 마세요):
얼마 전, 믿고 있던 무언가가 한순간에 무너지는 일이 있었던 것 같아요. 그 뒤로 한동안 앞이 잘 보이지 않았지만, 지금은 안개가 걷히듯 상황이 조금씩 또렷해지고 있어요.

다만 앞으로는, 마음이 이미 정리되어 가는데도 중요한 선택을 계속 미루면 엇갈린 채로 남을 수 있어요. 흔들림은 지나갔으니 이제 고르는 일만 남았어요. 오늘은 미뤄 둔 결정 하나를 종이에 적어 보세요.`;

const hits = new Map();   // IP별 최근 요청 시각 (서버 인스턴스마다 따로 세는 가벼운 제한)
function allow(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= PER_IP_LIMIT) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

function validate(body) {
  if (!body || typeof body !== 'object') return null;
  const sp = SPREADS[body.spread];
  if (!sp || !Array.isArray(body.cards) || body.cards.length !== sp.pos.length) return null;
  const seen = new Set();
  const cards = [];
  for (const c of body.cards) {
    const n = Number(c && c.n);
    if (!Number.isInteger(n) || n < 0 || n >= CARDS.length || seen.has(n)) return null;
    seen.add(n);
    cards.push({ n, rev: !!(c && c.rev) });
  }
  const question = String(body.question || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 140);
  const nm = Array.isArray(body.names) ? body.names : [];
  const clean = v => String(v || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 10);
  const names = [clean(nm[0]) || '첫 번째 사람', clean(nm[1]) || '두 번째 사람'];
  let topic = Object.prototype.hasOwnProperty.call(TOPICS, body.topic) ? body.topic : 'total';
  const topicText = clean(body.topicText);
  if (topic === 'custom' && !topicText) topic = 'total';
  return { spread: body.spread, topic, topicText, cards, question, names };
}

function buildPrompt(v, frame) {
  // 카드 이름·방향·천체 정보는 넘기지 않고, 뽑힌 방향의 뜻만 흐름 순서대로 넘겨요.
  // 그래야 풀이가 "어디에 무엇이 나왔다"는 설명 없이 해석에만 집중해요.
  const sp = SPREADS[v.spread];
  const pos = frame ? FRAMES[frame].pos : sp.pos;
  const guide = frame ? FRAMES[frame].guide : sp.guide;
  const lines = v.cards.map((pk, i) => {
    const c = CARDS[pk.n];
    const kw = (pk.rev ? c.rv : c.up).join(', ');
    const t = fillNames(pos[i].t, v.names), d = fillNames(pos[i].d, v.names);
    return `${i + 1}. [${t} · ${d}] 키워드: ${kw}. 뜻: ${pk.rev ? c.rvT : c.upT}`;
  }).join('\n');
  return [
    sp.noTopic ? '' : `주제: ${topicOf(v).name} (${topicOf(v).d})`,
    `질문: ${v.question ? `"${v.question}"` : `(${sp.noQ || `질문 없음. ${sp.noTopic ? '지금의 전반적인 흐름' : topicOf(v).name + '의 흐름'}을 봐 주세요`})`}`,
    guide ? `풀이 방식: ${fillNames(guide, v.names)}` : '',
    `흐름:\n${lines}`,
    `분량: ${sp.len}`
  ].filter(Boolean).join('\n');
}


// 질문만 보고(카드는 보지 않고) 쓰리 카드의 자리 틀을 골라요. 실패하면 과거·현재·미래.
async function pickFrame(v, headers) {
  if (!v.question) return 'ppf';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers, signal: ctl.signal,
      body: JSON.stringify({
        model: MODEL, max_tokens: 8,
        thinking: { type: 'disabled' }, output_config: { effort: 'low' },
        system: FRAME_SYSTEM,
        messages: [{ role: 'user', content: `주제: ${topicOf(v).name}\n질문: "${v.question}"` }]
      })
    });
    if (!r.ok) { console.log('frame error', r.status, (await r.text().catch(() => '')).slice(0, 300)); return 'ppf'; }
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').toLowerCase();
    const m = text.match(/\b(ppf|sao|rel|fork)\b/);
    return m ? m[1] : 'ppf';
  } catch (e) {
    console.log('frame failed', String(e));
    return 'ppf';
  } finally {
    clearTimeout(timer);
  }
}

function corsFor(request) {
  const origin = request.headers.get('origin') || '';
  const extra = String(process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  const allowed = [...DEFAULT_ORIGINS, ...extra];
  let sameHost = false;
  try { sameHost = !!origin && new URL(origin).host === new URL(request.url).host; } catch {}
  const ok = !origin || sameHost || allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok && origin ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
  };
}

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });

// Claude API의 스트리밍(SSE) 응답에서 글자만 뽑아 흘려보내는 스트림
function textStream(upstreamBody) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buf = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            let ev;
            try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
            if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta' && ev.delta.text) {
              controller.enqueue(enc.encode(ev.delta.text));
            } else if (ev.type === 'error') {
              console.log('stream error', JSON.stringify(ev.error || ev));
            }
          }
        }
      } catch (e) {
        console.log('stream failed', String(e));
      } finally {
        controller.close();
      }
    }
  });
}

export default {
  async fetch(request) {
    const c = corsFor(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
    if (request.method !== 'POST') return json({ error: 'not_found' }, 404, c.headers);
    if (!c.ok) return json({ error: 'forbidden' }, 403, c.headers);
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) { console.log('ANTHROPIC_API_KEY is not set'); return json({ error: 'not_configured' }, 500, c.headers); }

    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (!allow(ip)) return json({ error: 'rate_limited' }, 429, c.headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_request' }, 400, c.headers); }
    const v = validate(body);
    if (!v) return json({ error: 'bad_request' }, 400, c.headers);

    const headers = {
      'authorization': `Bearer ${key}`,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    };
    if (process.env.ANTHROPIC_WORKSPACE_ID) headers['anthropic-workspace-id'] = process.env.ANTHROPIC_WORKSPACE_ID;

    const frame = SPREADS[v.spread].framed ? await pickFrame(v, headers) : null;
    if (frame) console.log('frame', frame);

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'disabled' },      // 생각하는 단계 끄기
        output_config: { effort: 'low' },    // 가장 가볍게
        system: SYSTEM,
        messages: [{ role: 'user', content: buildPrompt(v, frame) }],
        stream: true
      })
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      console.log('anthropic error', upstream.status, detail.slice(0, 500));
      return json({ error: 'upstream' }, upstream.status === 429 ? 429 : 502, c.headers);
    }
    return new Response(textStream(upstream.body), {
      headers: { ...c.headers, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...(frame ? { 'X-Frame': frame } : {}) }
    });
  }
};

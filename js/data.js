window.WEDDING_DATA = {
  couple: {
    groom: {
      name: "이우빈",
      displayName: "우빈",
      english: "WOOBIN",
      father: "이성주",
      mother: "고인숙",
      relation: "장남"
    },
    bride: {
      name: "이경진",
      displayName: "경진",
      english: "KYOUNGJIN",
      father: "이재석",
      mother: "김전미",
      relation: "장녀"
    }
  },
  // 혼주 전화번호를 문자열로 입력하세요. 비워 두면 전화·문자 버튼이 비활성화됩니다.
  // 성함은 위 couple의 father, mother 값을 함께 사용합니다.
  // 아래 번호는 화면 확인용 임시 번호입니다. 실제 연락처로 교체해 주세요.
  contacts: {
    groom: { father: "", mother: "" },
    bride: { father: "", mother: "" }
  },
  wedding: {
    date: "2026-10-03"
  },
  copy: {
    invitation: [
      "함께 시간을 보내며<br>서로의 일상을 가장 가까이에서 나누는 일이<br>어느새 자연스러운 일이 되었습니다.",
      "그 시간을 지나<br>앞으로의 날들도 서로의 곁에서<br>함께 살아가기로 했습니다.",
      "저희 결혼식은 양가 가족과 함께하는 작은 자리로<br>조용히 치르려 합니다.",
      "직접 모시고 인사드리지 못하지만<br>멀리서도 저희의 새로운 시작을<br>기쁘게 지켜봐 주시고 축복해 주시면 감사하겠습니다."
    ],
    outro: "저희의 새로운 시작을<br>함께 기뻐해 주시고 축복해 주셔서 감사합니다.<br><br>앞으로 함께할 날들 속에서<br>좋은 순간에는 기쁨을 나누고,<br>어려운 순간에는 서로의 가장 가까운 편이 되어<br>늘 아끼고 의지하며 잘 살아가겠습니다.<br><br>저희 두 사람을 따뜻하게 바라봐 주신<br>그 소중한 마음을<br>오래도록 감사히 간직하겠습니다."
  },
  // 은행(bank), 계좌번호(number), 예금주(holder)를 모두 입력하면 표시됩니다.
  // 계좌번호는 앞자리 0과 하이픈을 유지하도록 따옴표 안에 입력하세요.
  accounts: {
    groom: [
      { label: "신랑", bank: "우리은행", number: "1002-550-380849", holder: "이우빈" },
      { label: "신랑 아버지", bank: "", number: "", holder: "이성주" },
      { label: "신랑 어머니", bank: "", number: "", holder: "고인숙" }
    ],
    bride: [
      { label: "신부", bank: "", number: "", holder: "이경진" },
      { label: "신부 아버지", bank: "", number: "", holder: "이재선" },
      { label: "신부 어머니", bank: "", number: "", holder: "김전미" }
    ]
  },
  // Google Apps Script 웹 앱의 /exec 주소를 입력하세요.
  // 연결 전에는 작성 폼 대신 준비 중 안내를 표시합니다. 설정: apps-script/README.md
  guestbook: {
    enabled: true,
    endpoint: "https://script.google.com/macros/s/AKfycbyidiaPzoB1r1PMerR3INj0hG28y6WQe6ggLS5yBOe3WO-_8Ivxu3feVybt0UBaoY9EcA/exec"
  },
  images: {
    hero: "./assets/images/main.png",
    gallery: [
      "./assets/images/gallery/01.png",
      "./assets/images/gallery/02.png",
      "./assets/images/gallery/03.png",
      "./assets/images/gallery/04.png",
      "./assets/images/gallery/05.png",
      "./assets/images/gallery/06.png",
      "./assets/images/gallery/07.png",
      "./assets/images/gallery/08.png",
      "./assets/images/gallery/09.png",
      "./assets/images/gallery/10.png",
      "./assets/images/gallery/11.png",
      "./assets/images/gallery/12.png",
      "./assets/images/gallery/13.png",
      "./assets/images/gallery/14.png",
      "./assets/images/gallery/15.png",
      "./assets/images/gallery/16.png",
      "./assets/images/gallery/17.png",
      "./assets/images/gallery/18.png"
    ]
  }
};

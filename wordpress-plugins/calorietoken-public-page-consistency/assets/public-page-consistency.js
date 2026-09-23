/* Narrow live repair for page IDs 8144 and 8263. */
(function(){
'use strict';
var cfg=window.CalorieTokenPublicPageConsistency||{};
if(!document.body||![8144,8263].includes(Number(cfg.page)))return;
var locale='en', observer=null, queued=false;
var localeNames=['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur'];

var titleCopy={
  en:{collaborate:'Collaborate',contribute:'Contribute Food Data'},
  nl:{collaborate:'Samenwerken',contribute:'Bijdragen aan voedseldata'},
  'zh-Hans':{collaborate:'合作',contribute:'贡献食品数据'},
  hi:{collaborate:'सहयोग',contribute:'खाद्य डेटा में योगदान दें'},
  es:{collaborate:'Colaborar',contribute:'Contribuir datos alimentarios'},
  ar:{collaborate:'التعاون',contribute:'المساهمة في بيانات الغذاء'},
  fr:{collaborate:'Collaborer',contribute:'Contribuer aux données alimentaires'},
  bn:{collaborate:'সহযোগিতা',contribute:'খাদ্য ডেটায় অবদান রাখুন'},
  pt:{collaborate:'Colaborar',contribute:'Contribuir com dados alimentares'},
  id:{collaborate:'Berkolaborasi',contribute:'Kontribusi data pangan'},
  ur:{collaborate:'تعاون',contribute:'خوراک کے ڈیٹا میں تعاون کریں'}
};

var collaborateCopy={
  en:{
    kicker:'CALORIETOKEN · COLLABORATION',
    heading:'Build with CalorieToken',
    intro:'Curious about food data, web applications or the XRP Ledger? Students, enthusiasts and experienced makers in the Netherlands and internationally are welcome to introduce themselves. CalorieApp is our current focus. Possible contributions include development, testing, design, documentation and community support.',
    step1:'1. Introduce yourself',step1Body:'Share your interests, skills and availability.',
    step2:'2. Explore the fit',step2Body:'We discuss a suitable task and the support it needs.',
    step3:'3. Agree before starting',step3Body:'Participation starts after both sides expressly agree to documented terms.',
    notice:'An enquiry does not guarantee a place, internship or employment. Tasks, supervision, confidentiality, rights to contributions and any compensation are agreed before work starts. Educational placements require a separate check with the institution, including any required recognition.',
    devTitle:'Developer community',
    devBefore:'Discuss technical ideas in the ',devAfter:'. Project work starts after discussion and mutual agreement.',
    formTitle:'Tell us about yourself',
    formIntro:'English or Dutch is fine. Share only information relevant to your collaboration enquiry; a phone number, identity document or CV upload is not needed.',
    name:'Name',email:'Email',background:'Background',interests:'What would you like to contribute to?',skills:'Skills and learning goals',availability:'Availability',language:'Preferred language and time zone',portfolio:'Portfolio, GitHub or LinkedIn',education:'Education and placement requirements, if applicable',conditions:'Conditions',submit:'Send your interest',
    checkbox:'I understand that applying does not guarantee participation, a placement or a job. Work starts only after discussion, documented terms and explicit agreement by both sides.',
    questions:'Questions?',back:'Back to the team'
  },
  nl:{
    kicker:'CALORIETOKEN · SAMENWERKEN',heading:'Bouw mee aan CalorieToken',
    intro:'Benieuwd naar voedseldata, webapplicaties of de XRP Ledger? Studenten, enthousiastelingen en ervaren makers uit Nederland en daarbuiten zijn welkom voor een kennismaking. CalorieApp is onze huidige focus. Mogelijke bijdragen zijn ontwikkeling, testen, ontwerp, documentatie en communityondersteuning.',
    step1:'1. Stel jezelf voor',step1Body:'Vertel over je interesses, vaardigheden en beschikbaarheid.',
    step2:'2. Bekijk wat past',step2Body:'We bespreken een passende taak en de benodigde begeleiding.',
    step3:'3. Spreek af vóór je begint',step3Body:'Je start pas na vastgelegde afspraken en expliciet akkoord van beide kanten.',
    notice:'Een aanmelding garandeert geen plek, stage of baan. Vooraf maken we afspraken over taken, begeleiding, vertrouwelijkheid, rechten op bijdragen en eventuele vergoeding. Voor een stage toetsen we ook de voorwaarden van de opleiding en eventuele vereiste erkenning.',
    devTitle:'Developercommunity',devBefore:'Bespreek technische ideeën in de ',devAfter:'. Meewerken begint pas na overleg en wederzijds akkoord.',
    formTitle:'Vertel iets over jezelf',formIntro:'Deel alleen informatie die relevant is voor je samenwerkingsvraag; een telefoonnummer, identiteitsbewijs of cv-upload is niet nodig.',
    name:'Naam',email:'E-mailadres',background:'Achtergrond',interests:'Waar wil je aan bijdragen?',skills:'Vaardigheden en leerdoelen',availability:'Beschikbaarheid',language:'Voorkeurstaal en tijdzone',portfolio:'Portfolio, GitHub of LinkedIn',education:'Opleiding en stagevoorwaarden, indien van toepassing',conditions:'Voorwaarden',submit:'Interesse versturen',
    checkbox:'Ik begrijp dat aanmelden geen deelname, stageplaats of baan garandeert. Meewerken begint pas na overleg, vastgelegde voorwaarden en uitdrukkelijk akkoord van beide kanten.',
    questions:'Vragen?',back:'Terug naar het team'
  },
  'zh-Hans':{
    kicker:'CALORIETOKEN · 合作',heading:'与 CalorieToken 一起建设',
    intro:'对食品数据、Web 应用或 XRP Ledger 感兴趣吗？荷兰及其他地区的学生、爱好者和有经验的创作者都可以介绍自己。CalorieApp 是我们目前的重点。可参与的方向包括开发、测试、设计、文档和社区支持。',
    step1:'1. 介绍自己',step1Body:'分享你的兴趣、技能和可投入时间。',
    step2:'2. 寻找合适方向',step2Body:'我们会讨论合适的任务以及所需支持。',
    step3:'3. 开始前达成一致',step3Body:'只有双方明确同意书面约定后才开始参与。',
    notice:'提交意向并不保证参与机会、实习或就业。开始前会就任务、指导、保密、贡献权利和可能的报酬达成协议。教育实习还需与学校核对要求及可能需要的资质。',
    devTitle:'开发者社区',devBefore:'可在 ',devAfter:' 中讨论技术想法。项目协作在沟通并双方同意后开始。',
    formTitle:'介绍一下自己',formIntro:'只需提供与合作咨询相关的信息；无需电话号码、身份证件或上传简历。',
    name:'姓名',email:'电子邮箱',background:'背景',interests:'你想参与什么？',skills:'技能与学习目标',availability:'可投入时间',language:'首选语言和时区',portfolio:'作品集、GitHub 或 LinkedIn',education:'教育和实习要求（如适用）',conditions:'条件',submit:'发送意向',
    checkbox:'我理解，提交申请并不保证参与、实习或工作机会。只有经过讨论、形成书面条件并由双方明确同意后才开始协作。',
    questions:'有问题？',back:'返回团队页面'
  },
  hi:{
    kicker:'CALORIETOKEN · सहयोग',heading:'CalorieToken के साथ निर्माण करें',
    intro:'खाद्य डेटा, वेब एप्लिकेशन या XRP Ledger में रुचि है? नीदरलैंड और अन्य देशों के छात्र, उत्साही और अनुभवी निर्माता अपना परिचय दे सकते हैं। अभी हमारा मुख्य फोकस CalorieApp है। योगदान में विकास, परीक्षण, डिज़ाइन, दस्तावेज़ीकरण और समुदाय सहायता शामिल हो सकते हैं।',
    step1:'1. अपना परिचय दें',step1Body:'अपनी रुचियाँ, कौशल और उपलब्धता बताएं।',
    step2:'2. उपयुक्त भूमिका देखें',step2Body:'हम उपयुक्त कार्य और आवश्यक सहायता पर चर्चा करते हैं।',
    step3:'3. शुरू करने से पहले सहमति',step3Body:'काम तभी शुरू होता है जब दोनों पक्ष लिखित शर्तों पर स्पष्ट रूप से सहमत हों।',
    notice:'रुचि भेजने से भागीदारी, इंटर्नशिप या नौकरी की गारंटी नहीं मिलती। काम शुरू होने से पहले कार्य, मार्गदर्शन, गोपनीयता, योगदान के अधिकार और संभावित भुगतान तय किए जाते हैं। शैक्षिक प्लेसमेंट के लिए संस्थान की शर्तें और आवश्यक मान्यता अलग से जाँची जाती है।',
    devTitle:'डेवलपर समुदाय',devBefore:'तकनीकी विचारों पर ',devAfter:' में चर्चा करें। परियोजना का काम बातचीत और आपसी सहमति के बाद शुरू होता है।',
    formTitle:'अपने बारे में बताएं',formIntro:'सिर्फ सहयोग से संबंधित जानकारी साझा करें; फोन नंबर, पहचान दस्तावेज़ या CV अपलोड आवश्यक नहीं है।',
    name:'नाम',email:'ईमेल',background:'पृष्ठभूमि',interests:'आप किसमें योगदान देना चाहते हैं?',skills:'कौशल और सीखने के लक्ष्य',availability:'उपलब्धता',language:'पसंदीदा भाषा और समय क्षेत्र',portfolio:'पोर्टफोलियो, GitHub या LinkedIn',education:'शिक्षा और प्लेसमेंट की आवश्यकताएँ, यदि लागू हों',conditions:'शर्तें',submit:'रुचि भेजें',
    checkbox:'मैं समझता/समझती हूँ कि आवेदन से भागीदारी, प्लेसमेंट या नौकरी की गारंटी नहीं मिलती। काम चर्चा, लिखित शर्तों और दोनों पक्षों की स्पष्ट सहमति के बाद ही शुरू होता है।',
    questions:'प्रश्न?',back:'टीम पर वापस जाएँ'
  },
  es:{
    kicker:'CALORIETOKEN · COLABORACIÓN',heading:'Construye con CalorieToken',
    intro:'¿Te interesan los datos alimentarios, las aplicaciones web o XRP Ledger? Estudiantes, entusiastas y profesionales con experiencia de los Países Bajos y de otros lugares pueden presentarse. CalorieApp es nuestro foco actual. Las posibles contribuciones incluyen desarrollo, pruebas, diseño, documentación y apoyo a la comunidad.',
    step1:'1. Preséntate',step1Body:'Comparte tus intereses, habilidades y disponibilidad.',
    step2:'2. Busca el encaje',step2Body:'Comentamos una tarea adecuada y el apoyo que necesita.',
    step3:'3. Acuerdo antes de empezar',step3Body:'La participación empieza después de que ambas partes acepten expresamente unas condiciones documentadas.',
    notice:'Una consulta no garantiza una plaza, unas prácticas ni un empleo. Antes de empezar se acuerdan las tareas, la supervisión, la confidencialidad, los derechos sobre las contribuciones y cualquier compensación. Las prácticas educativas requieren una comprobación adicional con la institución.',
    devTitle:'Comunidad de desarrolladores',devBefore:'Comenta ideas técnicas en ',devAfter:'. El trabajo de proyecto empieza tras hablarlo y llegar a un acuerdo mutuo.',
    formTitle:'Cuéntanos sobre ti',formIntro:'Comparte solo información relevante para tu consulta de colaboración; no hace falta teléfono, documento de identidad ni subir un CV.',
    name:'Nombre',email:'Correo electrónico',background:'Perfil',interests:'¿En qué te gustaría contribuir?',skills:'Habilidades y objetivos de aprendizaje',availability:'Disponibilidad',language:'Idioma y zona horaria preferidos',portfolio:'Portfolio, GitHub o LinkedIn',education:'Requisitos educativos y de prácticas, si corresponde',conditions:'Condiciones',submit:'Enviar interés',
    checkbox:'Entiendo que presentar una solicitud no garantiza participación, prácticas ni empleo. El trabajo empieza solo después de hablarlo, documentar las condiciones y obtener el acuerdo explícito de ambas partes.',
    questions:'¿Preguntas?',back:'Volver al equipo'
  },
  ar:{
    kicker:'CALORIETOKEN · التعاون',heading:'ساهم في بناء CalorieToken',
    intro:'هل تهتم ببيانات الأغذية أو تطبيقات الويب أو XRP Ledger؟ نرحب بالطلاب والمتحمسين وأصحاب الخبرة من هولندا ومن خارجها للتعريف بأنفسهم. ينصب تركيزنا حالياً على CalorieApp. ويمكن أن تشمل المساهمات التطوير والاختبار والتصميم والتوثيق ودعم المجتمع.',
    step1:'1. عرّف بنفسك',step1Body:'شارك اهتماماتك ومهاراتك ومدى توافرك.',
    step2:'2. ابحث عن الدور المناسب',step2Body:'نناقش مهمة مناسبة والدعم الذي تحتاجه.',
    step3:'3. اتفق قبل البدء',step3Body:'تبدأ المشاركة فقط بعد موافقة الطرفين صراحةً على شروط موثقة.',
    notice:'لا يضمن إرسال طلب فرصة مشاركة أو تدريب أو وظيفة. يتم الاتفاق قبل البدء على المهام والإشراف والسرية وحقوق المساهمات وأي مقابل. وتتطلب فرص التدريب التعليمي مراجعة منفصلة مع المؤسسة والمتطلبات اللازمة.',
    devTitle:'مجتمع المطورين',devBefore:'ناقش الأفكار التقنية في ',devAfter:'. يبدأ العمل على المشروع بعد النقاش والاتفاق المتبادل.',
    formTitle:'عرّفنا بنفسك',formIntro:'شارك فقط المعلومات المتعلقة بطلب التعاون؛ لا حاجة إلى رقم هاتف أو وثيقة هوية أو رفع سيرة ذاتية.',
    name:'الاسم',email:'البريد الإلكتروني',background:'الخلفية',interests:'بماذا تود أن تساهم؟',skills:'المهارات وأهداف التعلم',availability:'التوافر',language:'اللغة والمنطقة الزمنية المفضلة',portfolio:'Portfolio أو GitHub أو LinkedIn',education:'متطلبات الدراسة أو التدريب إن وجدت',conditions:'الشروط',submit:'إرسال الاهتمام',
    checkbox:'أفهم أن التقديم لا يضمن المشاركة أو التدريب أو الوظيفة. يبدأ العمل فقط بعد النقاش وتوثيق الشروط والموافقة الصريحة من الطرفين.',
    questions:'أسئلة؟',back:'العودة إلى الفريق'
  },
  fr:{
    kicker:'CALORIETOKEN · COLLABORATION',heading:'Construisez avec CalorieToken',
    intro:'Les données alimentaires, les applications web ou XRP Ledger vous intéressent ? Étudiants, passionnés et profils expérimentés des Pays-Bas et d’ailleurs peuvent se présenter. CalorieApp est notre priorité actuelle. Les contributions possibles incluent le développement, les tests, le design, la documentation et le soutien communautaire.',
    step1:'1. Présentez-vous',step1Body:'Partagez vos centres d’intérêt, vos compétences et vos disponibilités.',
    step2:'2. Trouvez le bon rôle',step2Body:'Nous discutons d’une tâche adaptée et de l’accompagnement nécessaire.',
    step3:'3. Accord avant de commencer',step3Body:'La participation commence uniquement après accord explicite des deux parties sur des conditions documentées.',
    notice:'Une prise de contact ne garantit ni participation, ni stage, ni emploi. Les tâches, l’encadrement, la confidentialité, les droits sur les contributions et toute rémunération sont convenus avant le début. Les stages d’études nécessitent une vérification séparée avec l’établissement.',
    devTitle:'Communauté des développeurs',devBefore:'Discutez d’idées techniques sur ',devAfter:'. Le travail de projet commence après discussion et accord mutuel.',
    formTitle:'Parlez-nous de vous',formIntro:'Partagez uniquement les informations utiles à votre demande de collaboration ; aucun numéro de téléphone, document d’identité ou CV à téléverser n’est nécessaire.',
    name:'Nom',email:'E-mail',background:'Profil',interests:'À quoi souhaitez-vous contribuer ?',skills:'Compétences et objectifs d’apprentissage',availability:'Disponibilité',language:'Langue et fuseau horaire préférés',portfolio:'Portfolio, GitHub ou LinkedIn',education:'Exigences d’études et de stage, le cas échéant',conditions:'Conditions',submit:'Envoyer votre intérêt',
    checkbox:'Je comprends qu’une candidature ne garantit ni participation, ni stage, ni emploi. Le travail commence seulement après discussion, conditions documentées et accord explicite des deux parties.',
    questions:'Des questions ?',back:'Retour à l’équipe'
  },
  bn:{
    kicker:'CALORIETOKEN · সহযোগিতা',heading:'CalorieToken-এর সঙ্গে তৈরি করুন',
    intro:'খাদ্য ডেটা, ওয়েব অ্যাপ্লিকেশন বা XRP Ledger নিয়ে আগ্রহী? নেদারল্যান্ডস ও অন্যান্য দেশের শিক্ষার্থী, আগ্রহী ব্যক্তি এবং অভিজ্ঞ নির্মাতারা নিজেদের পরিচয় দিতে পারেন। CalorieApp এখন আমাদের প্রধান ফোকাস। উন্নয়ন, পরীক্ষা, ডিজাইন, ডকুমেন্টেশন ও কমিউনিটি সহায়তায় অবদান রাখা যেতে পারে।',
    step1:'1. নিজের পরিচয় দিন',step1Body:'আপনার আগ্রহ, দক্ষতা ও সময়ের প্রাপ্যতা জানান।',
    step2:'2. উপযুক্ত কাজ খুঁজুন',step2Body:'আমরা উপযুক্ত কাজ এবং প্রয়োজনীয় সহায়তা নিয়ে আলোচনা করি।',
    step3:'3. শুরু করার আগে সম্মতি',step3Body:'উভয় পক্ষ লিখিত শর্তে স্পষ্টভাবে সম্মত হওয়ার পরেই অংশগ্রহণ শুরু হয়।',
    notice:'যোগাযোগ করা অংশগ্রহণ, ইন্টার্নশিপ বা চাকরির নিশ্চয়তা দেয় না। কাজ শুরুর আগে কাজের পরিধি, তত্ত্বাবধান, গোপনীয়তা, অবদানের অধিকার ও সম্ভাব্য পারিশ্রমিক নিয়ে সম্মতি হয়। শিক্ষামূলক প্লেসমেন্টের জন্য প্রতিষ্ঠানের শর্ত আলাদাভাবে যাচাই করা হয়।',
    devTitle:'ডেভেলপার কমিউনিটি',devBefore:'প্রযুক্তিগত ধারণা আলোচনা করুন ',devAfter:'-এ। আলোচনা ও পারস্পরিক সম্মতির পর প্রকল্পের কাজ শুরু হয়।',
    formTitle:'নিজের সম্পর্কে বলুন',formIntro:'সহযোগিতা সম্পর্কিত প্রাসঙ্গিক তথ্যই দিন; ফোন নম্বর, পরিচয়পত্র বা CV আপলোডের দরকার নেই।',
    name:'নাম',email:'ইমেইল',background:'পটভূমি',interests:'আপনি কোন কাজে অবদান রাখতে চান?',skills:'দক্ষতা ও শেখার লক্ষ্য',availability:'সময় দেওয়ার সুযোগ',language:'পছন্দের ভাষা ও সময় অঞ্চল',portfolio:'Portfolio, GitHub বা LinkedIn',education:'শিক্ষা ও প্লেসমেন্টের শর্ত, প্রযোজ্য হলে',conditions:'শর্তাবলি',submit:'আগ্রহ পাঠান',
    checkbox:'আমি বুঝি যে আবেদন করলে অংশগ্রহণ, প্লেসমেন্ট বা চাকরির নিশ্চয়তা নেই। আলোচনা, লিখিত শর্ত এবং উভয় পক্ষের স্পষ্ট সম্মতির পরেই কাজ শুরু হয়।',
    questions:'প্রশ্ন?',back:'টিমে ফিরে যান'
  },
  pt:{
    kicker:'CALORIETOKEN · COLABORAÇÃO',heading:'Construa com a CalorieToken',
    intro:'Tem interesse em dados alimentares, aplicações web ou no XRP Ledger? Estudantes, entusiastas e profissionais experientes dos Países Baixos e de outros locais podem apresentar-se. A CalorieApp é o nosso foco atual. As contribuições podem incluir desenvolvimento, testes, design, documentação e apoio à comunidade.',
    step1:'1. Apresente-se',step1Body:'Partilhe os seus interesses, competências e disponibilidade.',
    step2:'2. Encontre o melhor encaixe',step2Body:'Discutimos uma tarefa adequada e o apoio necessário.',
    step3:'3. Acordo antes de começar',step3Body:'A participação começa apenas depois de ambas as partes concordarem expressamente com condições documentadas.',
    notice:'Um contacto não garante participação, estágio ou emprego. As tarefas, supervisão, confidencialidade, direitos sobre contribuições e qualquer compensação são acordados antes do início. Estágios educativos exigem uma verificação separada com a instituição.',
    devTitle:'Comunidade de programadores',devBefore:'Discuta ideias técnicas no ',devAfter:'. O trabalho de projeto começa depois de discussão e acordo mútuo.',
    formTitle:'Fale-nos de si',formIntro:'Partilhe apenas informação relevante para o pedido de colaboração; não é necessário telefone, documento de identificação ou envio de CV.',
    name:'Nome',email:'E-mail',background:'Perfil',interests:'Em que gostaria de contribuir?',skills:'Competências e objetivos de aprendizagem',availability:'Disponibilidade',language:'Idioma e fuso horário preferidos',portfolio:'Portfolio, GitHub ou LinkedIn',education:'Requisitos de educação e estágio, se aplicável',conditions:'Condições',submit:'Enviar interesse',
    checkbox:'Compreendo que a candidatura não garante participação, estágio ou emprego. O trabalho só começa após discussão, condições documentadas e acordo explícito de ambas as partes.',
    questions:'Dúvidas?',back:'Voltar à equipa'
  },
  id:{
    kicker:'CALORIETOKEN · KOLABORASI',heading:'Bangun bersama CalorieToken',
    intro:'Tertarik pada data pangan, aplikasi web, atau XRP Ledger? Pelajar, penggemar, dan pembuat berpengalaman dari Belanda maupun negara lain dipersilakan memperkenalkan diri. CalorieApp adalah fokus kami saat ini. Kontribusi dapat mencakup pengembangan, pengujian, desain, dokumentasi, dan dukungan komunitas.',
    step1:'1. Perkenalkan diri',step1Body:'Ceritakan minat, keterampilan, dan ketersediaan Anda.',
    step2:'2. Temukan kecocokan',step2Body:'Kami membahas tugas yang sesuai dan dukungan yang dibutuhkan.',
    step3:'3. Sepakati sebelum mulai',step3Body:'Partisipasi dimulai setelah kedua pihak secara tegas menyetujui ketentuan yang terdokumentasi.',
    notice:'Mengirim pertanyaan tidak menjamin partisipasi, magang, atau pekerjaan. Tugas, pendampingan, kerahasiaan, hak atas kontribusi, dan kompensasi apa pun disepakati sebelum mulai. Penempatan pendidikan memerlukan pemeriksaan terpisah dengan institusi.',
    devTitle:'Komunitas developer',devBefore:'Diskusikan ide teknis di ',devAfter:'. Pekerjaan proyek dimulai setelah diskusi dan persetujuan bersama.',
    formTitle:'Ceritakan tentang diri Anda',formIntro:'Bagikan hanya informasi yang relevan dengan permintaan kolaborasi; nomor telepon, dokumen identitas, atau unggahan CV tidak diperlukan.',
    name:'Nama',email:'Email',background:'Latar belakang',interests:'Anda ingin berkontribusi pada apa?',skills:'Keterampilan dan tujuan belajar',availability:'Ketersediaan',language:'Bahasa dan zona waktu pilihan',portfolio:'Portfolio, GitHub, atau LinkedIn',education:'Persyaratan pendidikan dan penempatan, jika berlaku',conditions:'Ketentuan',submit:'Kirim minat',
    checkbox:'Saya memahami bahwa mendaftar tidak menjamin partisipasi, magang, atau pekerjaan. Pekerjaan dimulai hanya setelah diskusi, ketentuan terdokumentasi, dan persetujuan tegas kedua pihak.',
    questions:'Pertanyaan?',back:'Kembali ke tim'
  },
  ur:{
    kicker:'CALORIETOKEN · تعاون',heading:'CalorieToken کے ساتھ تعمیر کریں',
    intro:'کیا آپ خوراک کے ڈیٹا، ویب ایپلیکیشنز یا XRP Ledger میں دلچسپی رکھتے ہیں؟ نیدرلینڈز اور دیگر ممالک کے طلبہ، شوقین افراد اور تجربہ کار بنانے والے اپنا تعارف کرا سکتے ہیں۔ اس وقت ہماری توجہ CalorieApp پر ہے۔ تعاون میں ڈیولپمنٹ، ٹیسٹنگ، ڈیزائن، دستاویزات اور کمیونٹی سپورٹ شامل ہو سکتی ہے۔',
    step1:'1. اپنا تعارف کرائیں',step1Body:'اپنی دلچسپیاں، مہارتیں اور دستیابی بتائیں۔',
    step2:'2. مناسب کردار تلاش کریں',step2Body:'ہم مناسب کام اور درکار تعاون پر بات کرتے ہیں۔',
    step3:'3. شروع کرنے سے پہلے اتفاق',step3Body:'کام صرف اس وقت شروع ہوتا ہے جب دونوں فریق تحریری شرائط پر واضح طور پر متفق ہوں۔',
    notice:'درخواست دینا شرکت، انٹرن شپ یا ملازمت کی ضمانت نہیں دیتا۔ کام شروع ہونے سے پہلے کام، نگرانی، رازداری، تعاون کے حقوق اور ممکنہ معاوضے پر اتفاق کیا جاتا ہے۔ تعلیمی پلیسمنٹ کے لیے ادارے کی شرائط الگ سے جانچی جاتی ہیں۔',
    devTitle:'ڈیولپر کمیونٹی',devBefore:'تکنیکی خیالات پر ',devAfter:' میں گفتگو کریں۔ منصوبے پر کام گفتگو اور باہمی اتفاق کے بعد شروع ہوتا ہے۔',
    formTitle:'اپنے بارے میں بتائیں',formIntro:'صرف وہ معلومات شیئر کریں جو تعاون کی درخواست سے متعلق ہوں؛ فون نمبر، شناختی دستاویز یا CV اپ لوڈ ضروری نہیں ہے۔',
    name:'نام',email:'ای میل',background:'پس منظر',interests:'آپ کس چیز میں تعاون کرنا چاہتے ہیں؟',skills:'مہارتیں اور سیکھنے کے اہداف',availability:'دستیابی',language:'پسندیدہ زبان اور ٹائم زون',portfolio:'Portfolio، GitHub یا LinkedIn',education:'تعلیم اور پلیسمنٹ کی شرائط، اگر لاگو ہوں',conditions:'شرائط',submit:'دلچسپی بھیجیں',
    checkbox:'میں سمجھتا/سمجھتی ہوں کہ درخواست سے شرکت، پلیسمنٹ یا ملازمت کی ضمانت نہیں ملتی۔ کام صرف گفتگو، تحریری شرائط اور دونوں فریقوں کی واضح رضامندی کے بعد شروع ہوتا ہے۔',
    questions:'سوالات؟',back:'ٹیم پر واپس جائیں'
  }
};

function resolveLocale(value){
  var v=typeof value==='string'?value.trim().replace(/_/g,'-'):'';
  if(/^zh(?:-|$)/i.test(v))return 'zh-Hans';
  var exact=localeNames.find(function(x){return x.toLowerCase()===v.toLowerCase();});
  if(exact)return exact;
  var primary=v.split('-')[0];
  return localeNames.includes(primary)?primary:'en';
}
function currentLocale(){
  if(window.CalorieTokenDiscoveryUI&&typeof window.CalorieTokenDiscoveryUI.getLocale==='function'){
    try{return resolveLocale(window.CalorieTokenDiscoveryUI.getLocale());}catch(_){}
  }
  var data=document.documentElement.dataset.ctDisplayLocale;
  if(data)return resolveLocale(data);
  try{
    var saved=JSON.parse(localStorage.getItem('calorieapp.display-language.v1'));
    if(saved&&saved.locale)return resolveLocale(saved.locale);
  }catch(_){}
  return resolveLocale(document.documentElement.lang||'en');
}
function setImportant(node,name,value){if(node)node.style.setProperty(name,value,'important');}
function pairVisibility(root,tag){
  if(!root)return;
  var useNl=tag==='nl';
  root.querySelectorAll('[lang="nl"]').forEach(function(node){setImportant(node,'display',useNl?'revert':'none');});
  root.querySelectorAll('[lang="en"]').forEach(function(node){setImportant(node,'display',useNl?'none':'revert');});
}
function dedupeHeaders(){
  var primary=document.querySelector('.ct-public-inline-header');
  if(!primary)return;
  document.querySelectorAll('.ctstyle-header-fallback').forEach(function(node){
    if(node!==primary&&!node.closest('template'))setImportant(node,'display','none');
  });
}
function setText(selector,value,root){
  var node=(root||document).querySelector(selector);
  if(node&&typeof value==='string')node.textContent=value;
}
function directTextReplace(root,from,to){
  if(!root||from===to)return;
  var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  var nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(function(node){if(node.data.replace(/\s+/g,' ').trim()===from)node.data=node.data.replace(from,to);});
}
function localizeCollaborate(tag){
  var root=document.getElementById('ct-collaborate');if(!root)return;
  var c=collaborateCopy[tag]||collaborateCopy.en;
  root.lang=tag;root.dir=['ar','ur'].includes(tag)?'rtl':'ltr';
  setText('p[style*="#505ba9"]',c.kicker,root);
  setText('#ct-collaborate-title',c.heading,root);
  var h=root.querySelector('#ct-collaborate-title');
  var intro=h&&h.nextElementSibling;if(intro&&intro.tagName==='P')intro.textContent=c.intro;
  var steps=root.querySelectorAll('.ct-step');
  [[c.step1,c.step1Body],[c.step2,c.step2Body],[c.step3,c.step3Body]].forEach(function(row,i){
    var step=steps[i];if(!step)return;var strong=step.querySelector('strong');if(strong)strong.textContent=row[0];
    Array.from(step.childNodes).forEach(function(node){if(node.nodeType===3&&node.data.trim())node.remove();});
    var br=step.querySelector('br');if(br)br.remove();
    step.querySelectorAll('[lang]').forEach(function(node){node.remove();});
    step.append(document.createTextNode(row[1]));
  });
  var notices=root.querySelectorAll('.ct-notice');
  if(notices[0])notices[0].textContent=c.notice;
  if(notices[1]){
    var p=notices[1].querySelector('p');if(p){
      var a=p.querySelector('a');p.replaceChildren();
      var strong=document.createElement('strong');strong.textContent=c.devTitle;p.append(strong,document.createElement('br'),document.createTextNode(c.devBefore));
      if(a)p.append(a);p.append(document.createTextNode(c.devAfter));
    }
  }
  var formTitle=Array.from(root.querySelectorAll('h3')).find(function(n){return /Tell us about yourself|Vertel iets over jezelf/i.test(n.textContent);});
  if(formTitle){formTitle.textContent=c.formTitle;var p=formTitle.nextElementSibling;if(p&&p.tagName==='P')p.textContent=c.formIntro;}
  var labels={
    applicant_name:c.name,email:c.email,background:c.background,interests:c.interests,skills:c.skills,
    availability:c.availability,language_timezone:c.language,portfolio:c.portfolio,education:c.education
  };
  Object.keys(labels).forEach(function(name){
    var field=root.querySelector('[name="'+name+'"]');if(!field)return;
    var label=root.querySelector('label[for="'+field.id+'"]');if(label){
      Array.from(label.childNodes).filter(function(n){return n.nodeType===3;}).forEach(function(n){n.remove();});
      label.insertBefore(document.createTextNode(labels[name]),label.firstChild);
      label.setAttribute('aria-label',labels[name]);
    }
  });
  var conditionLabel=Array.from(root.querySelectorAll('.ff-el-input--label>label')).find(function(n){return /Voorwaarden|Conditions/.test(n.textContent);});
  if(conditionLabel){conditionLabel.textContent=c.conditions;conditionLabel.setAttribute('aria-label',c.conditions);}
  var check=root.querySelector('input[name="participation_understanding[]"]');
  if(check){var lab=check.closest('label');var span=lab&&lab.querySelector('span');if(span)span.textContent=c.checkbox;check.setAttribute('aria-label',c.checkbox);}
  var submit=root.querySelector('button[type="submit"]');if(submit){submit.textContent=c.submit;submit.setAttribute('aria-label',c.submit);}
  var final=Array.from(root.querySelectorAll(':scope > p')).slice(-1)[0];
  if(final&&final.querySelector('a[href^="mailto:"]')){
    var mail=final.querySelector('a[href^="mailto:"]'),back=final.querySelector('a[href*="/contact/"]');
    final.replaceChildren(document.createTextNode(c.questions+' '),mail,document.createTextNode(' · '),back);
    if(back)back.textContent=c.back;
  }
  pairVisibility(root,tag);
}
function localizeContribute(tag){
  var root=document.querySelector('.ct-contribute');if(!root)return;
  root.lang=tag;root.dir=['ar','ur'].includes(tag)?'rtl':'ltr';
  pairVisibility(root,tag);
  var nl=tag==='nl';
  var labels={
    prices:nl?'Open Prices · Voedselprijzen':'Open Prices · Food prices',
    restaurants:nl?'OpenNutrition · Restaurantgerechten':'OpenNutrition · Restaurant foods',
    business:nl?'Voedingsondernemers':'Food businesses'
  };
  Object.keys(labels).forEach(function(id){var n=root.querySelector('#'+id+' summary strong');if(n)n.textContent=labels[id];});
  var rules=root.querySelector('#prices a[href*="open-prices/guides"]');if(rules)rules.textContent=nl?'Bron- en dataregels':'Source and data rules';
  var method=root.querySelector('#restaurants .ct-contribute-button');if(method)method.textContent=nl?'OpenNutrition · Werkwijze en contact ↗':'OpenNutrition · Method and contact ↗';
}
function apply(){
  queued=false;locale=currentLocale();dedupeHeaders();
  var page=Number(cfg.page),title=document.querySelector('.ct-public-inline-title .ctstyle-heading');
  if(title){var t=titleCopy[locale]||titleCopy.en;title.textContent=page===8263?t.collaborate:t.contribute;title.lang=locale;title.dir=['ar','ur'].includes(locale)?'rtl':'ltr';}
  if(page===8263)localizeCollaborate(locale);
  if(page===8144)localizeContribute(locale);
}
function queue(){if(!queued){queued=true;requestAnimationFrame(apply);}}
function ready(){
  apply();
  observer=new MutationObserver(function(records){
    if(records.some(function(r){return r.type==='childList'||(r.type==='attributes'&&['class','data-ct-display-locale','lang','dir'].includes(r.attributeName));}))queue();
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','lang','dir']});
  var htmlObserver=new MutationObserver(queue);htmlObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-ct-display-locale','lang','dir']});
  document.addEventListener('calorietoken:display-language',function(e){locale=resolveLocale(e.detail&&e.detail.locale||'');queue();});
  window.addEventListener('pageshow',queue);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
// .vitepress/config.js
import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'Save My Self Project',
    description: 'BMSG Archieve',
    head: [
        ['link', { rel: 'icon', href: '/favicon.ico' }]
    ],
    locales: {
        root: {
            label: '中文',
            lang: 'zh-CN',
            link: '/',
            themeConfig: {
                nav: [
                    {
                        text: 'Management 2 BMSG增刊',
                        link: '/zh-cn/Management2Extra/README'
                    },
                    {
                        text: 'Management 2',
                        link: '/zh-cn/Management2/README'
                    }
                ],
            }
        },
        'zh-cn': {
            locale: 'zh-CN',
            label: '中文',
            link: '/zh-cn/README',
            themeConfig: {
                nav: [
                    {
                        text: 'Management 2 BMSG增刊',
                        link: '/zh-cn/Management2Extra/README'
                    },
                    {
                        text: 'Management 2',
                        link: '/zh-cn/Management2/README'
                    }
                ],
                sidebar: {
                    '/zh-cn/Management2Extra/': [
                        {
                            text: 'SKY-HI管理的故事2 BMSG增刊',
                            items: [
                                {
                                    text: '谈论BMSG',
                                    collapsed: false,
                                    items: [
                                        {
                                            text: '01_NovelCore',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/01_NovelCore'
                                        },
                                        {
                                            text: '02_AlieTheShota',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/02_AlieTheShota'
                                        },
                                        {
                                            text: '03_EdhiiiBoi',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/03_EdhiiiBoi'
                                        },
                                        {
                                            text: '04_Reiko',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/04_Reiko'
                                        },
                                        {
                                            text: '05_SOTA',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/05_SOTA'
                                        },
                                        {
                                            text: '06_SHUNTO',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/06_SHUNTO'
                                        },
                                        {
                                            text: '07_MANATO',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/07_MANATO'
                                        },
                                        {
                                            text: '08_RYUHEI',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/08_RYUHEI'
                                        },
                                        {
                                            text: '09_JUNON',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/09_JUNON'
                                        },
                                        {
                                            text: '10_RYOKI',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/10_RYOKI'
                                        },
                                        {
                                            text: '11_LEO',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/11_LEO'
                                        },
                                        {
                                            text: '12_KAIRYU',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/12_KAIRYU'
                                        },
                                        {
                                            text: '13_NAOYA',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/13_NAOYA'
                                        },
                                        {
                                            text: '14_RAN',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/14_RAN'
                                        },
                                        {
                                            text: '15_SEITO',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/15_SEITO'
                                        },
                                        {
                                            text: '16_RYUKI',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/16_RYUKI'
                                        },
                                        {
                                            text: '17_TAKUTO',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/17_TAKUTO'
                                        },
                                        {
                                            text: '18_HAYATO',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/18_HAYATO'
                                        },
                                        {
                                            text: '19_EIKI',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/19_EIKI'
                                        },
                                        {
                                            text: '20_RUI',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/20_RUI'
                                        },
                                        {
                                            text: '21_TAIKI',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/21_TAIKI'
                                        },
                                        {
                                            text: '22_KANON',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/22_KANON'
                                        },
                                        {
                                            text: '23_Trainee',
                                            link: '/zh-cn/Management2Extra/01_TalkAboutBMSG/23_Trainee'
                                        }
                                    ]
                                },
                                {
                                    text: '往期采访',
                                    collapsed: false,
                                    items: [
                                        {
                                            text: 'Novel Core',
                                            link: '/zh-cn/Management2Extra/02_Interview/01_NovelCore/01_NovelCore'
                                        },
                                        {
                                            text: 'BE:FIRST',
                                            items: [
                                                {
                                                    text: '成员访谈',
                                                    link: '/zh-cn/Management2Extra/02_Interview/02_BEFIRST/01_BefirstMemberInterview'
                                                },
                                                {
                                                    text: '团体访谈',
                                                    link: '/zh-cn/Management2Extra/02_Interview/02_BEFIRST/02_BefirstGroupInterview'
                                                },
                                                {
                                                    text: 'SKY-HI访谈',
                                                    link: '/zh-cn/Management2Extra/02_Interview/02_BEFIRST/03_SkyHiInterviewAboutBefirst'
                                                }
                                            ]
                                        },
                                        {
                                            text: 'MAZZEL',
                                            items: [
                                                {
                                                    text: '成员访谈',
                                                    link: '/zh-cn/Management2Extra/02_Interview/03_MAZZEL/01_MazzelMemberInterview'
                                                },
                                                {
                                                    text: '团体访谈',
                                                    link: '/zh-cn/Management2Extra/02_Interview/03_MAZZEL/02_MazzelGroupInterview'
                                                },
                                                {
                                                    text: 'SKY-HI访谈',
                                                    link: '/zh-cn/Management2Extra/02_Interview/03_MAZZEL/03_SkyhiInterviewAboutMazzel'
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    text: '编年史',
                                    link: '/zh-cn/Management2Extra/03_Chronicle/01_Chronicle'
                                },
                                {
                                    text: '编辑后记',
                                    link: '/zh-cn/Management2Extra/04_EditorsNote/04_EditorsNote'
                                }
                            ]
                        },
                    ]
                }
            }
        }

    },
    outDir: './dist'
})
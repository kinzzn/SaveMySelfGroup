// .vitepress/config.js
import { defineConfig } from 'vitepress'
import { readdirSync, statSync, existsSync } from 'fs'
import { join, basename, extname } from 'path'

// 获取文件夹和文件的帮助函数
function getDirectoryItems(dirPath, basePath = '') {
    if (!existsSync(dirPath)) return []
    
    return readdirSync(dirPath)
        .filter(item => !item.startsWith('.'))
        .map(item => {
            const fullPath = join(dirPath, item)
            const isDirectory = statSync(fullPath).isDirectory()
            const linkPath = basePath ? `${basePath}/${item}` : item
            
            return {
                name: item,
                path: fullPath,
                linkPath,
                isDirectory,
                displayName: getDisplayName(item)
            }
        })
        .sort((a, b) => {
            // 优先显示文件夹，然后按数字和字母排序
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name, undefined, { numeric: true })
        })
}

// 获取显示名称
function getDisplayName(fileName) {
    const nameMap = {
        'Management2Extra': 'Management 2 BMSG增刊',
        'Management2': 'Management 2',
        'Others': '其他',
        '01_TalkAboutBMSG': '谈论BMSG',
        '02_Interview': '往期采访',
        '03_Chronicle': '编年史',
        '04_EditorsNote': '编辑后记',
        '01_NovelCore': 'Novel Core',
        '02_BEFIRST': 'BE:FIRST',
        '03_MAZZEL': 'MAZZEL',
        'PART3': 'PART3',
        'NoNoGirls': 'NoNoGirls: 迈向更理想形态的女团选秀',
        '02_AlieTheShota': 'Alie The Shota',
        '03_EdhiiiBoi': 'edhiii boi',
        '01_Chronicle': '编年史',
        '01_BefirstMemberInterview': '成员采访',
        '02_BefirstGroupInterview': '团体采访',
        '03_SkyHiInterviewAboutBefirst': 'SKY-HI谈论BE:FIRST',
        '01_MazzelMemberInterview': '成员采访',
        '02_MazzelGroupInterview': '团体采访',
        '03_SkyhiInterviewAboutMazzel': 'SKY-HI谈论MAZZEL',
        'gqux': '为《机动战士高达GQuuuuuuX》增添色彩的音乐',
        'rollingkawatani': '川谷绘音回顾 2025 年的音乐生态'   
    }
    
    // 移除文件扩展名
    const nameWithoutExt = extname(fileName) ? basename(fileName, extname(fileName)) : fileName
    
    // 返回映射的名称或处理后的文件名
    return nameMap[nameWithoutExt] || nameWithoutExt.replace(/^\d+_/, '').replace(/_/g, ' ')
}

// 生成侧边栏配置
function generateSidebar(baseDir, prefix) {
    function buildSidebarItems(dirPath, currentPrefix) {
        const items = getDirectoryItems(dirPath, currentPrefix)
        const result = []
        
        for (const item of items) {
            if (item.isDirectory) {
                const subItems = buildSidebarItems(item.path, item.linkPath)
                if (subItems.length > 0) {
                    result.push({
                        text: item.displayName,
                        collapsed: false,
                        items: subItems
                    })
                }
            } else if (item.name.endsWith('.md') && !item.name.startsWith('README')) {
                result.push({
                    text: item.displayName,
                    link: `${prefix}/${item.linkPath.replace('.md', '')}`
                })
            }
        }
        
        return result
    }
    
    return buildSidebarItems(baseDir, '')
}

// 生成导航配置
function generateNavigation(locale) {
    const baseDir = locale === 'zh-cn' ? './zh-cn' : './ja-jp'
    
    const navItems = []
    
    // 合并Management 2相关导航为下拉菜单
    const management2Items = []
    if (existsSync(join(baseDir, 'Management2'))) {
        management2Items.push({
            text: '本篇',
            link: `/${locale}/Management2/README`
        })
    }
    
    if (existsSync(join(baseDir, 'Management2Extra'))) {
        management2Items.push({
            text: '增刊',
            link: `/${locale}/Management2Extra/README`
        })
    }
    
    if (management2Items.length > 0) {
        navItems.push({
            text: 'Management 2',
            items: management2Items
        })
    }
    
    if (existsSync(join(baseDir, 'Others'))) {
        navItems.push({
            text: '其他',
            link: `/${locale}/Others/README`
        })
    }
    
    return navItems
}

// 生成侧边栏配置对象
function generateSidebarConfig(locale) {
    const baseDir = locale === 'zh-cn' ? './zh-cn' : './ja-jp'
    const sidebarConfig = {}
    
    // Management2
    if (existsSync(join(baseDir, 'Management2'))) {
        const management2Items = generateSidebar(
            join(baseDir, 'Management2'), 
            `/${locale}/Management2`
        )
        if (management2Items.length > 0) {
            sidebarConfig[`/${locale}/Management2/`] = management2Items
        }
    }
    
    // Management2Extra
    if (existsSync(join(baseDir, 'Management2Extra'))) {
        const management2ExtraItems = generateSidebar(
            join(baseDir, 'Management2Extra'), 
            `/${locale}/Management2Extra`
        )
        if (management2ExtraItems.length > 0) {
            sidebarConfig[`/${locale}/Management2Extra/`] = [{
                items: management2ExtraItems
            }]
        }
    }
    
    // Others
    if (existsSync(join(baseDir, 'Others'))) {
        const othersItems = generateSidebar(
            join(baseDir, 'Others'), 
            `/${locale}/Others`
        )
        if (othersItems.length > 0) {
            sidebarConfig[`/${locale}/Others/`] = [{
                items: othersItems
            }]
        }
    }
    
    return sidebarConfig
}

export default defineConfig({
    base: '/SaveMySelfGroup/',
    title: 'Save My Self Project',
    description: 'BMSG Archieve',
    head: [
        ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }]
    ],
    locales: {
        root: {
            label: '中文',
            lang: 'zh-CN',
            link: '/',
            themeConfig: {
                nav: generateNavigation('zh-cn')
            }
        },
        'zh-cn': {
            locale: 'zh-CN',
            label: '中文',
            link: '/zh-cn/README',
            themeConfig: {
                nav: generateNavigation('zh-cn'),
                sidebar: generateSidebarConfig('zh-cn')
            }
        }
    },
    outDir: './dist'
})
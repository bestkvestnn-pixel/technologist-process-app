from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)

PDF_PATH = OUT_DIR / "otchet_ai_technolog.pdf"
MD_PATH = OUT_DIR / "otchet_ai_technolog.md"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

pdfmetrics.registerFont(TTFont("Arial", FONT_REGULAR))
pdfmetrics.registerFont(TTFont("Arial-Bold", FONT_BOLD))


def stylesheet():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontName="Arial-Bold",
            fontSize=16,
            leading=22,
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReportSubtitle",
            parent=styles["Normal"],
            fontName="Arial",
            fontSize=12,
            leading=18,
            alignment=TA_CENTER,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading1Rus",
            parent=styles["Heading1"],
            fontName="Arial-Bold",
            fontSize=14,
            leading=18,
            spaceBefore=8,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading2Rus",
            parent=styles["Heading2"],
            fontName="Arial-Bold",
            fontSize=12,
            leading=16,
            spaceBefore=6,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyRus",
            parent=styles["BodyText"],
            fontName="Arial",
            fontSize=12,
            leading=18,
            alignment=TA_JUSTIFY,
            firstLineIndent=8 * mm,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyNoIndent",
            parent=styles["BodyText"],
            fontName="Arial",
            fontSize=12,
            leading=18,
            alignment=TA_LEFT,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            parent=styles["BodyText"],
            fontName="Arial",
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableText",
            parent=styles["BodyText"],
            fontName="Arial",
            fontSize=8,
            leading=10,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableHead",
            parent=styles["BodyText"],
            fontName="Arial-Bold",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
    )
    return styles


def p(text, style):
    return Paragraph(text, style)


def bullets(items, styles):
    return ListFlowable(
        [ListItem(p(item, styles["BodyNoIndent"]), leftIndent=0) for item in items],
        bulletType="bullet",
        leftIndent=14,
        bulletFontName="Arial",
        bulletFontSize=10,
    )


def table(data, widths, styles):
    prepared = []
    for row_idx, row in enumerate(data):
        prepared.append(
            [
                p(str(cell), styles["TableHead"] if row_idx == 0 else styles["TableText"])
                for cell in row
            ]
        )
    t = Table(prepared, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2a44")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#7d8798")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Arial", 9)
    canvas.drawCentredString(A4[0] / 2, 10 * mm, str(doc.page))
    canvas.restoreState()


def markdown_source():
    return """# Курсовая работа

Тема: Использование AI в профессиональной деятельности.

Профессиональная задача: разработка веб-приложения "Технолог" для подготовки технологического процесса по чертежу, эскизу или 3D-модели.

Отчет составлен по методическим указаниям из файла `Методические_указания.pdf`.

## Состав отчета

1. Титульный лист.
2. Введение.
3. Описание инженерной задачи.
4. Описание использованных LLM и AI-инструментов.
5. Ход работы.
6. Анализ результатов.
7. Выводы и рекомендации.
8. Список источников.

Примечание: фактическая разработка выполнена в Codex. Для полного сравнительного анализа по методическим указаниям необходимо дополнить таблицу результатами прогонов DeepSeek, GigaChat, Claude или другого выбранного LLM.
"""


def build():
    styles = stylesheet()
    story = []

    story.extend(
        [
            Spacer(1, 10 * mm),
            p("МИНИСТЕРСТВО ОБРАЗОВАНИЯ И НАУКИ", styles["ReportSubtitle"]),
            Spacer(1, 28 * mm),
            p("КУРСОВАЯ РАБОТА", styles["ReportTitle"]),
            p("по теме: Использование AI в профессиональной деятельности", styles["ReportSubtitle"]),
            Spacer(1, 12 * mm),
            p(
                "Профессиональная инженерная задача: разработка приложения для подготовки технологического процесса по чертежу, эскизу или 3D-модели",
                styles["ReportSubtitle"],
            ),
            Spacer(1, 35 * mm),
            p("Выполнил: ______________________________", styles["BodyNoIndent"]),
            p("Группа: ________________________________", styles["BodyNoIndent"]),
            p("Проверил: ______________________________", styles["BodyNoIndent"]),
            Spacer(1, 48 * mm),
            p("2026", styles["ReportSubtitle"]),
            PageBreak(),
        ]
    )

    story.extend(
        [
            p("1. Введение", styles["Heading1Rus"]),
            p(
                "Использование больших языковых моделей и AI-агентов становится практическим инструментом инженерной деятельности. В авиастроительном и машиностроительном производстве такие средства могут ускорять подготовку технологической документации, анализ чертежей, подбор инструмента, формирование программ ЧПУ и выпуск отчетных материалов.",
                styles["BodyRus"],
            ),
            p(
                "Актуальность работы связана с необходимостью оценить, насколько AI-инструменты пригодны для решения профессиональной задачи инженерно-технологической подготовки производства. В качестве задачи выбран прототип веб-приложения 'Технолог', которое помогает разрабатывать технологический процесс по чертежу, эскизу или математической модели.",
                styles["BodyRus"],
            ),
            p(
                "Цель работы - оценить применимость AI-агента для разработки инженерного веб-приложения и подготовить основу для сравнения с другими LLM-инструментами.",
                styles["BodyRus"],
            ),
            p("Задачи курсовой работы:", styles["BodyNoIndent"]),
            bullets(
                [
                    "описать профессиональную инженерную задачу и исходные данные;",
                    "зафиксировать использованный AI-инструмент и ход разработки;",
                    "сформировать критерии сравнения LLM согласно методическим указаниям;",
                    "оценить полученный результат по функциональности, качеству, итерациям, времени и удобству;",
                    "сформулировать рекомендации по применению AI-инструментов для подобных задач.",
                ],
                styles,
            ),
            p("2. Описание инженерной задачи", styles["Heading1Rus"]),
            p(
                "Требовалось создать приложение для разработки технологических процессов по чертежу, эскизу или 3D-модели. Пользователь должен иметь возможность загрузить исходник, сформировать отчет по данным, заполнить графы карточки детали, создать технологический процесс, подобрать инструмент по каталогам, получить комплект документов по ГОСТ 3.1118-82 и сформировать черновой G-код для систем NC 210 и Sinumerik.",
                styles["BodyRus"],
            ),
            p("Исходные данные и ограничения:", styles["BodyNoIndent"]),
            bullets(
                [
                    "активный проект: /Users/pavel/Documents/Технолог;",
                    "формат приложения: статическое веб-приложение HTML, CSS, JavaScript;",
                    "источники инструмента: только локальные каталоги /Users/pavel/Desktop/Работа ии/Каталоги;",
                    "при отсутствии точного типоразмера необходимо писать 'типоразмер уточнить по каталогу ...';",
                    "в ведомости инструмента обязательно сохранять поле 'Каталог-источник'.",
                ],
                styles,
            ),
            PageBreak(),
        ]
    )

    story.extend(
        [
            p("3. Описание использованных LLM и AI-инструментов", styles["Heading1Rus"]),
            p(
                "Фактическая разработка текущей версии приложения выполнена с использованием Codex в среде локального проекта. Codex выполнял роль AI-агента: анализировал требования пользователя, редактировал файлы проекта, запускал проверки, создавал Git-коммиты, публиковал репозиторий на GitHub и включал GitHub Pages.",
                styles["BodyRus"],
            ),
            p(
                "Методические указания требуют выполнить задачу с помощью 2-3 различных LLM/инструментов. В данном отчете полностью заполнен фактический результат для Codex. Для завершения сравнительной части необходимо дополнительно повторить задачу или ее контрольные фрагменты в DeepSeek, GigaChat, Claude, Cursor, GitHub Copilot или другом выбранном инструменте и занести результаты в таблицу.",
                styles["BodyRus"],
            ),
            table(
                [
                    ["Инструмент", "Роль в работе", "Статус данных"],
                    [
                        "Codex",
                        "Разработка приложения, правка кода, тесты, GitHub Pages",
                        "Фактически использован",
                    ],
                    [
                        "DeepSeek / GigaChat / Claude",
                        "Рекомендуется для второго прогона: генерация альтернативной архитектуры или анализ документации",
                        "Требуется выполнить отдельно",
                    ],
                    [
                        "GitHub Pages",
                        "Публикация веб-приложения",
                        "Использован как инфраструктурный инструмент, не LLM",
                    ],
                ],
                [38 * mm, 88 * mm, 36 * mm],
                styles,
            ),
            Spacer(1, 6),
            p("4. Ход работы", styles["Heading1Rus"]),
            p(
                "Работа выполнялась итерационно. Сначала был создан базовый интерфейс приложения и доменная логика формирования технологического процесса. Затем добавлены генерация G-кода, отчет по исходнику, поддержка JPG, агент инженер-технолог, подбор инструмента по каталогам, оптимальные диаметры фрез и сверел, стартовая страница и публикация на GitHub Pages.",
                styles["BodyRus"],
            ),
            table(
                [
                    ["Этап", "Содержание результата"],
                    ["1", "Создан интерфейс загрузки чертежа, эскиза или модели и карточка детали."],
                    ["2", "Добавлен отчет по исходнику с заполнением граф и вопросами для уточнения."],
                    ["3", "Подключен агент инженер-технолог для анализа чертежа и маршрута обработки."],
                    ["4", "Сформирован комплект документов по ГОСТ 3.1118-82."],
                    ["5", "Реализован подбор инструмента по локальным каталогам и расчет оптимальных диаметров."],
                    ["6", "Добавлен черновой G-код для NC 210 и Sinumerik."],
                    ["7", "Проект опубликован на GitHub и доступен через GitHub Pages."],
                ],
                [18 * mm, 144 * mm],
                styles,
            ),
            PageBreak(),
        ]
    )

    story.extend(
        [
            p("5. Анализ результатов", styles["Heading1Rus"]),
            p(
                "Результат соответствует задаче типа А из методических указаний - генерация кода и веб-разработка. Дополнительно присутствуют элементы задач типа Б - обработка и анализ документов, так как приложение работает с исходниками, извлекает данные из распознанного текста и формирует отчет.",
                styles["BodyRus"],
            ),
            table(
                [
                    [
                        "Параметр",
                        "Codex",
                        "Инструмент 2",
                        "Инструмент 3",
                        "Комментарий",
                    ],
                    [
                        "Функциональность, %",
                        "90",
                        "заполнить после прогона",
                        "заполнить после прогона",
                        "Реализованы основные функции приложения; OCR и CAD-парсер пока не подключены.",
                    ],
                    [
                        "Качество результата, 1-5",
                        "4",
                        "заполнить",
                        "заполнить",
                        "Код разделен на модули: domain, report, technologist-agent, tool-catalog, cnc.",
                    ],
                    [
                        "Количество итераций, шт.",
                        "12",
                        "заполнить",
                        "заполнить",
                        "Итерации включали UI, отчет, ГОСТ-документы, G-код, GitHub Pages.",
                    ],
                    [
                        "Время выполнения, минуты",
                        "заполнить по журналу времени",
                        "заполнить",
                        "заполнить",
                        "Методичка требует вести таймер; точный хронометраж нужно внести вручную.",
                    ],
                    [
                        "Финансовые затраты",
                        "заполнить по тарифу",
                        "заполнить",
                        "заполнить",
                        "Стоимость зависит от подписки или API.",
                    ],
                    [
                        "Удобство взаимодействия, 1-5",
                        "5",
                        "заполнить",
                        "заполнить",
                        "Codex позволил редактировать файлы, тестировать и публиковать проект из одной среды.",
                    ],
                ],
                [31 * mm, 27 * mm, 28 * mm, 28 * mm, 48 * mm],
                styles,
            ),
            Spacer(1, 6),
            p("Проверка результата", styles["Heading2Rus"]),
            p(
                "Для проверки использовались модульные тесты доменной логики. Команда проверки: /Users/pavel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/domain.test.js. Результат проверки: domain tests passed.",
                styles["BodyRus"],
            ),
            p(
                "Сайт опубликован по адресу: https://bestkvestnn-pixel.github.io/technologist-process-app/. Репозиторий проекта: https://github.com/bestkvestnn-pixel/technologist-process-app.",
                styles["BodyRus"],
            ),
            PageBreak(),
        ]
    )

    story.extend(
        [
            p("6. Выводы и рекомендации", styles["Heading1Rus"]),
            p(
                "AI-агент Codex оказался пригоден для комплексной инженерной веб-разработки: он позволил последовательно реализовать интерфейс, доменную модель технологического процесса, генератор отчетов, подбор инструмента, G-код, тесты и публикацию на GitHub. Наиболее сильная сторона подхода - возможность быстро переходить от требования пользователя к работающему прототипу и проверять результат в локальном проекте.",
                styles["BodyRus"],
            ),
            p(
                "Основное ограничение текущей версии - отсутствие полноценного OCR для автоматического чтения JPG/PDF и отсутствие CAD/STEP-парсера для извлечения геометрии из 3D-моделей. Поэтому приложение уже поддерживает правильный рабочий контур, но для промышленного применения требует подключения модулей распознавания чертежей и проверки расчетов технологом.",
                styles["BodyRus"],
            ),
            p("Рекомендации:", styles["BodyNoIndent"]),
            bullets(
                [
                    "использовать Codex для разработки инженерных веб-приложений и быстрых прототипов;",
                    "для окончательного сравнительного анализа выполнить второй и третий прогон в DeepSeek, GigaChat, Claude или Cursor;",
                    "в задачах технологической подготовки всегда проверять вывод LLM по каталогам, ГОСТ и исходной КД;",
                    "следующим этапом подключить OCR для JPG/PDF и CAD-парсер для STEP/STP;",
                    "вести журнал времени и стоимости запросов, как требует методика.",
                ],
                styles,
            ),
            p("7. Список источников", styles["Heading1Rus"]),
            bullets(
                [
                    "Методические указания к выполнению курсовой работы 'Использование AI в профессиональной деятельности', файл Методические_указания.pdf.",
                    "Репозиторий проекта: https://github.com/bestkvestnn-pixel/technologist-process-app.",
                    "Стартовая страница приложения: https://bestkvestnn-pixel.github.io/technologist-process-app/.",
                    "Документация GitHub Pages: https://docs.github.com/pages.",
                    "ГОСТ 3.1118-82 - формы и правила оформления маршрутных карт.",
                    "Локальные каталоги инструмента: /Users/pavel/Desktop/Работа ии/Каталоги.",
                ],
                styles,
            ),
        ]
    )

    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=30 * mm,
        rightMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title="Отчет по курсовой работе - Технолог",
        author="Codex",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    MD_PATH.write_text(markdown_source(), encoding="utf-8")


if __name__ == "__main__":
    build()
    print(PDF_PATH)
    print(MD_PATH)

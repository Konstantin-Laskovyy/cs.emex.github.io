import unittest

from app.api.news import sanitize_news_html


class NewsHtmlSanitizerTests(unittest.TestCase):
    def test_removes_scripts_events_and_unsafe_urls(self) -> None:
        source = (
            '<p onclick="steal()">Текст</p>'
            '<script>alert(1)</script>'
            '<a href="javascript:alert(1)">Опасная ссылка</a>'
            '<img src="javascript:alert(1)" onerror="steal()">'
        )

        result = sanitize_news_html(source)

        self.assertNotIn("<script", result)
        self.assertNotIn("onclick", result)
        self.assertNotIn("onerror", result)
        self.assertNotIn("javascript:", result)

    def test_preserves_only_supported_tiptap_formatting(self) -> None:
        source = (
            '<h1 style="text-align: center; position: fixed" data-indent="2">Заголовок</h1>'
            '<p style="text-align: justify" data-indent="1">'
            '<span style="font-family: Georgia; font-size: 18px; color: #075fab; '
            'background-color: #fff2a8; line-height: 1.5; display: none">Текст</span>'
            "</p>"
        )

        result = sanitize_news_html(source)

        self.assertIn("<h1", result)
        self.assertIn('style="text-align: center"', result)
        self.assertIn('data-indent="2"', result)
        self.assertIn("font-family: Georgia", result)
        self.assertIn("font-size: 18px", result)
        self.assertIn("color: #075fab", result)
        self.assertIn("background-color: #fff2a8", result)
        self.assertIn("line-height: 1.5", result)
        self.assertNotIn("position", result)
        self.assertNotIn("display", result)

    def test_validates_image_attributes(self) -> None:
        source = (
            '<img src="/uploads/news/example.webp" alt="Схема" title="Схема" '
            'width="640" height="480" data-align="right">'
            '<img src="/uploads/news/large.webp" width="9000" data-align="outside">'
        )

        result = sanitize_news_html(source)

        self.assertIn('src="/uploads/news/example.webp"', result)
        self.assertIn('width="640"', result)
        self.assertIn('height="480"', result)
        self.assertIn('data-align="right"', result)
        self.assertNotIn('width="9000"', result)
        self.assertNotIn('data-align="outside"', result)

    def test_converts_legacy_plain_text(self) -> None:
        result = sanitize_news_html("Первая строка\nВторая строка")

        self.assertEqual(result, "Первая строка<br>Вторая строка")


if __name__ == "__main__":
    unittest.main()

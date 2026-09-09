from pathlib import Path

from django import forms

from .models import WebsiteRequest


class WebsiteRequestForm(forms.ModelForm):
    website = forms.CharField(required=False, widget=forms.HiddenInput)

    class Meta:
        model = WebsiteRequest
        fields = ("name", "phone", "email", "comment", "brief", "consent")
        widgets = {
            "name": forms.TextInput(attrs={"placeholder": "Как к вам обращаться", "autocomplete": "name"}),
            "phone": forms.TextInput(
                attrs={"placeholder": "+7 ___ ___-__-__", "inputmode": "tel", "autocomplete": "tel"}
            ),
            "email": forms.EmailInput(attrs={"placeholder": "name@company.ru", "autocomplete": "email"}),
            "comment": forms.Textarea(
                attrs={
                    "placeholder": "Что нужно сделать и когда планируете запуск",
                    "rows": 4,
                }
            ),
            "consent": forms.CheckboxInput(attrs={"required": True}),
            "brief": forms.FileInput(attrs={"accept": ".pdf,.png,.jpg,.jpeg,.docx,.zip"}),
        }

    def clean_website(self):
        if self.cleaned_data.get("website"):
            raise forms.ValidationError("Не удалось отправить форму.")
        return ""

    def clean_phone(self):
        value = self.cleaned_data["phone"].strip()
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) < 10:
            raise forms.ValidationError("Укажите телефон полностью.")
        return value

    def clean_consent(self):
        if not self.cleaned_data.get("consent"):
            raise forms.ValidationError("Подтвердите согласие на обработку данных.")
        return True

    def clean_comment(self):
        value = self.cleaned_data.get("comment", "").strip()
        if len(value) > 5000:
            raise forms.ValidationError("Сократите описание до 5000 символов или приложите файл.")
        return value

    def clean_brief(self):
        file = self.cleaned_data.get("brief")
        if not file:
            return file
        if file.size > 10 * 1024 * 1024:
            raise forms.ValidationError("Максимальный размер файла — 10 МБ.")
        signatures = {".pdf": (b"%PDF",), ".png": (b"\x89PNG\r\n\x1a\n",), ".jpg": (b"\xff\xd8\xff",), ".jpeg": (b"\xff\xd8\xff",), ".docx": (b"PK\x03\x04",), ".zip": (b"PK\x03\x04", b"PK\x05\x06")}
        expected = signatures.get(Path(file.name).suffix.lower())
        header = file.read(8)
        file.seek(0)
        if not expected or not header.startswith(expected):
            raise forms.ValidationError("Прикрепите PDF, PNG, JPG, DOCX или ZIP.")
        return file

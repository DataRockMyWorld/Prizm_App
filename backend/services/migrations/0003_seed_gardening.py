from django.db import migrations

CATEGORY = dict(
    name="Gardening", slug="gardening", estimate_min="150.00", estimate_max="350.00"
)


def seed_gardening(apps, schema_editor):
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    ServiceCategory.objects.get_or_create(slug=CATEGORY["slug"], defaults=CATEGORY)


def remove_gardening(apps, schema_editor):
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    ServiceCategory.objects.filter(slug=CATEGORY["slug"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0002_seed_categories"),
    ]

    operations = [
        migrations.RunPython(seed_gardening, remove_gardening),
    ]

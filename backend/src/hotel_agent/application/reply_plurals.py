HOTEL_FORMS = ("отель", "отеля", "отелей")


def hotels_ru(count: int) -> str:
    tail = count % 100
    if 11 <= tail <= 14:
        return f"{count} {HOTEL_FORMS[2]}"
    last = count % 10
    if last == 1:
        return f"{count} {HOTEL_FORMS[0]}"
    if 2 <= last <= 4:
        return f"{count} {HOTEL_FORMS[1]}"
    return f"{count} {HOTEL_FORMS[2]}"


def hotels_en(count: int) -> str:
    return f"{count} hotel" if count == 1 else f"{count} hotels"

#!/usr/bin/env python3
# Test script to verify whitelist functionality

def test_whitelist():
    # Test content with whitelist terms
    test_content = """
    This is a test with Novel Core and BE:FIRST.
    Also testing D.U.N.K Showcase and THE FIRST.
    Some regular text with spaces and punctuation!
    Another line with Aile The Shota.
    """
    
    # Whitelist terms
    whitelist_terms = [
        'D.U.N.K Showcase',
        'Novel Core',
        'BE:FIRST',
        'BMSG FES',
        'THE GAME CENTER',
        'THE LAST PIECE',
        'THE FIRST',
        'BMSG POSSE',
        'Name Tag',
        'Aile The Shota',
        'edhiii boi'
    ]
    
    # Create placeholders
    placeholder_map = {}
    content = test_content
    for i, term in enumerate(whitelist_terms):
        placeholder = f'__WHITELIST_PLACEHOLDER_{i}__'
        placeholder_map[placeholder] = term
        content = content.replace(term, placeholder)
    
    print("After placeholder substitution:")
    print(content)
    
    # Apply space removal (Rule 1)
    content = content.replace(' ', '')
    print("After space removal:")
    print(content)
    
    # Restore whitelist terms
    for placeholder, original_term in placeholder_map.items():
        content = content.replace(placeholder, original_term)
    
    print("After restoration:")
    print(content)

if __name__ == "__main__":
    test_whitelist()

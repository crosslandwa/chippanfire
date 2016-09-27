<?php

final class Link {
    private static $_baseUrl = 'https://chippanfire.com/';

    private $_href;
    private $_text;
    private $_isExternal;
    private $_classes;

    public static function useRelative() {
        self::$_baseUrl = '';
    }

    private function __construct($text, $href, $isExternal, $classes) {
        $this->_text = $text;
        $this->_href = $href;
        $this->_isExternal = $isExternal;
        $this->_classes = $classes;
    }

    public final static function mailTo($text, $mailTo) {
        return new Link($text, $mailTo, false, '');
    }

    public final static function internal($text, $href) {
        return new Link($text, self::$_baseUrl . $href, false, '');
    }

    public final static function external($text, $href) {
        return new Link($text, $href, true, '');
    }

    public final function withText($text) {
        return new Link($text, $this->_href, $this->_isExternal, $this->_classes);
    }

    public final function withClasses($classes) {
        return new Link($this->_text, $this->_href, $this->_isExternal, $classes);
    }

    public final function __toString() {
        $text = $this->_text;

        $attributes = array (
            'class' => $this->_classes,
            'href' => $this->_href
        );

        if ($this->_isExternal) {
            $text .= ' <i class="icon-external-link"></i>';
            $attributes['target'] = '_blank';
        }

        $aAttributes = '';
        foreach ($attributes as $attribute => $value) {
            $aAttributes .= " {$attribute}=\"{$value}\"";
        }

        return '<a' . $aAttributes . '>' . $text . '</a>';
    }

}

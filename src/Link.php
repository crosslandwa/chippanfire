<?php

final class Link {
    private $_href;
    private $_text;
    private $_isExternal;
    private $_classes;

    private function __construct($text, $href, $isExternal, $classes) {
        $this->_text = $text;
        $this->_href = $href;
        $this->_isExternal = $isExternal;
        $this->_classes = $classes;
    }

    public final static function internal($text, $href) {
        return new Link($text, $href, false, '');
    }

    public final static function external($text, $href) {
        return new Link($text, $href, true, '');
    }

    public final function withClasses($classes) {
        return new Link($this->_text, $this->_href, $this->_isExternal, $classes);
    }

    public final function __toString() {
        $text = $this->_text;

        if ($this->_isExternal) {
            $text .= ' <i class="fa fa-external-link"></i>';
        }
        return '<a class="' . $this->_classes . '" href="' . $this->_href . '">' . $text . '</a>';
    }

}

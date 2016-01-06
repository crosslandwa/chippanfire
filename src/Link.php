<?php

final class Link {
    private $_href;
    private $_text;
    private $_isExternal;
    private $_classes;

    private function __construct($href, $text, $isExternal, $classes) {
        $this->_href = $href;
        $this->_text = $text;
        $this->_isExternal = $isExternal;
        $this->_classes = $classes;
    }

    public final static function internal($href, $text) {
        return new Link($href, $text, false, '');
    }

    public final static function external($href, $text) {
        return new Link($href, $text, true, '');
    }

    public final function withClasses($classes) {
        return new Link($this->_href, $this->_text, $this->_isExternal, $classes);
    }

    public final function __toString() {
        $text = $this->_text;

        if ($this->_isExternal) {
            $text .= ' <i class="fa fa-external-link"></i>';
        }
        return '<a class="' . $this->_classes . '" href="' . $this->_href . '">' . $text . '</a>';
    }

}
